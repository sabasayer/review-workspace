import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import { contrastRatio, type Rgb } from '../ui/src/contrast.ts'
import { fileURLToPath } from 'node:url'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

const docScreenshots = join(fileURLToPath(new URL('..', import.meta.url)), 'docs/screenshots')
const login = { type: 'file', path: 'src/auth/login.ts' }

let clock = 0

function raised(id: string, body: string, extra: Record<string, unknown> = {}) {
  const createdAt = new Date(Date.UTC(2026, 1, 1, 0, 0, (clock += 1))).toISOString()
  return JSON.stringify({ type: 'raised', id, createdAt, body, target: login, ...extra }) + '\n'
}

function parseCssColor(value: string): Rgb {
  return value.match(/\d+(\.\d+)?/g)!.slice(0, 3).map(Number) as unknown as Rgb
}

const panelButton = (page: Page) => page.getByRole('button', { name: 'Question panel' })

test.describe('Question panel states', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4381, (bundlePath, review) => {
      review.answers = [{ id: 'a-done', questionId: 'q-done', body: 'It is 60 seconds.' }]
      writeFileSync(
        join(bundlePath, 'questions.jsonl'),
        raised('q-wait', 'Waiting question?') +
          raised('q-live', 'Answering question?') +
          raised('q-done', 'Answered question?') +
          raised('cr-1', 'Please rename this.', { kind: 'change-request' }),
      )
      writeFileSync(join(bundlePath, 'watcher.json'), JSON.stringify({ enabled: true, cap: 20, used: 1, current: 'q-live' }))
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('shows waiting, answering and answered in words and icon, and no agent state for a change-request', async ({ page }) => {
    await openReview(page, served.url)
    await panelButton(page).click()
    const panel = page.getByTestId('question-panel')
    const thread = (text: string) => panel.getByTestId('question-thread').filter({ hasText: text })

    for (const [text, state, label] of [
      ['Waiting question?', 'waiting', 'Waiting'],
      ['Answering question?', 'answering', 'Answering'],
      ['Answered question?', 'answered', 'Answered'],
    ] as const) {
      const card = thread(text)
      await expect(card).toHaveAttribute('data-state', state)
      const badge = card.getByTestId('thread-state')
      await expect(badge).toHaveText(label)
      await expect(badge.locator('[class*="i-lucide-"], svg').first()).toBeVisible()
    }

    const change = thread('Please rename this.')
    await expect(change).toHaveAttribute('data-state', 'none')
    await expect(change.getByTestId('thread-state')).toHaveCount(0)
    await panel.screenshot({ path: join(docScreenshots, 'question-panel-states.png') })
  })

  test('lists the newest Comment first', async ({ page }) => {
    await openReview(page, served.url)
    await panelButton(page).click()
    const bodies = await page.getByTestId('question-thread').locator('p.leading-relaxed').allTextContents()
    expect(bodies.map((b) => b.trim())).toEqual(['Please rename this.', 'Answered question?', 'Answering question?', 'Waiting question?'])
  })
})

test.describe('Question panel flow', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4382)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('opens on a clicked marker, defaults the composer to its Target and stays open after sending', async ({ page }) => {
    await openReview(page, served.url)
    await page.getByRole('button', { name: /^Question:/ }).first().click()
    const panel = page.getByTestId('question-panel')
    await expect(panel.getByTestId('question-thread').filter({ hasText: 'What is the rate limit window?' })).toHaveClass(/ring-primary/)
    await expect(panel.getByTestId('composer-target')).toHaveValue('line:src/auth/login.ts:head:42')

    await panel.getByPlaceholder("What's the reasoning here?").fill('And what about bursts?')
    await panel.getByRole('button', { name: 'Ask', exact: true }).click()

    await expect(panel).toBeVisible()
    const first = panel.getByTestId('question-thread').first()
    await expect(first).toContainText('And what about bursts?')
    await expect(first).toHaveAttribute('data-state', 'waiting')
    await expect(panel.getByPlaceholder("What's the reasoning here?")).toHaveValue('')
  })

  test('lets the Reviewer ask the next Question about the whole change', async ({ page }) => {
    await openReview(page, served.url)
    await panelButton(page).click()
    const panel = page.getByTestId('question-panel')
    await panel.getByTestId('composer-target').selectOption('general')
    await panel.getByPlaceholder("What's the reasoning here?").fill('Is there a lock-out message?')
    await panel.getByRole('button', { name: 'Ask', exact: true }).click()
    const card = panel.getByTestId('question-thread').filter({ hasText: 'Is there a lock-out message?' })
    await expect(card.getByTestId('thread-target')).toHaveText('Whole change')
  })

  test('closes with the close button and reopens with the header button', async ({ page }) => {
    await openReview(page, served.url)
    await panelButton(page).click()
    await expect(page.getByTestId('question-panel')).toBeVisible()
    await page.getByRole('button', { name: 'Close the Question panel' }).click()
    await expect(page.getByTestId('question-panel')).toHaveCount(0)
  })
})

test.describe('new Answer', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4383, (bundlePath, review) => {
      review.answers = []
      writeFileSync(join(bundlePath, 'questions.jsonl'), raised('q-new', 'Will you answer me?'))
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('gives a toast and a readable badge, and the badge clears when the thread opens', async ({ page }) => {
    await openReview(page, served.url)
    await expect(page.getByTestId('panel-badge')).toHaveAttribute('data-tone', 'open')

    const reviewPath = join(served.bundlePath, 'review.json')
    const review = JSON.parse(readFileSync(reviewPath, 'utf-8'))
    review.answers = [{ id: 'a-new', questionId: 'q-new', body: 'Yes, here it is.' }]
    writeFileSync(reviewPath, JSON.stringify(review, null, 2))

    await expect(page.getByText('New answer', { exact: true })).toBeVisible({ timeout: 15_000 })
    const badge = page.getByTestId('panel-badge')
    await expect(badge).toHaveAttribute('data-tone', 'new')
    await expect(badge).toContainText('1 new answer')

    const look = await badge.evaluate((el) => {
      const style = getComputedStyle(el)
      return { size: parseFloat(style.fontSize), color: style.color, background: style.backgroundColor }
    })
    expect(look.size).toBeGreaterThanOrEqual(14)
    expect(contrastRatio(parseCssColor(look.color), parseCssColor(look.background))).toBeGreaterThanOrEqual(4.5)

    await page.getByRole('button', { name: 'Open', exact: true }).click()
    const thread = page.getByTestId('question-panel').getByTestId('question-thread')
    await expect(thread).toHaveAttribute('data-state', 'answered')
    await expect(thread).toContainText('Yes, here it is.')
    await expect(page.getByTestId('panel-badge')).toHaveCount(0)
  })
})

test.describe('open badge contrast', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4384, (bundlePath, review) => {
      review.answers = []
      appendFileSync(join(bundlePath, 'questions.jsonl'), raised('q-open', 'Still open?'))
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`the count badge is readable in the ${theme} theme`, async ({ page }) => {
      await openReview(page, served.url)
      await page.emulateMedia({ colorScheme: theme })
      await page.evaluate((t) => document.documentElement.classList.toggle('dark', t === 'dark'), theme)
      const badge = page.getByTestId('panel-badge')
      const look = await badge.evaluate((el) => {
        const style = getComputedStyle(el)
        return { size: parseFloat(style.fontSize), color: style.color, background: style.backgroundColor }
      })
      expect(look.size).toBeGreaterThanOrEqual(14)
      expect(contrastRatio(parseCssColor(look.color), parseCssColor(look.background))).toBeGreaterThanOrEqual(4.5)
    })
  }
})
