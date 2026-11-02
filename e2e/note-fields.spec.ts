import { test, expect } from '@playwright/test'
import { openReview, serveFixtureCopy, type ServedBundle } from './support.ts'

test.describe('note fields on an inline note', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4330)
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('starts the collapsed row with the line number', async ({ page }) => {
    await openReview(page, served.url)
    const note = page.getByTestId('inline-note').first()
    await expect(note.getByTestId('note-line-label')).toHaveText('line 42')
    await expect(note.getByRole('button').first()).toContainText(/^\s*line 42/)
  })

  test('shows verdict, severity, source and a separate suggestion block when open', async ({ page }) => {
    await openReview(page, served.url)
    const note = page.getByTestId('inline-note').first()
    await note.getByRole('button').first().click()
    await expect(note.getByTestId('note-verdict')).toHaveText('Wrong')
    await expect(note.getByTestId('note-severity')).toHaveText('medium severity')
    await expect(note.getByTestId('note-source')).toHaveText('asked by: nobody')
    await expect(note.getByTestId('note-suggestion')).toContainText('Count only failed attempts, not every login.')
    await expect(note.getByTestId('note-suggestion')).not.toContainText('Rejects further attempts')
  })

  test('highlights the target line on hover and while the note is open', async ({ page }) => {
    await openReview(page, served.url)
    const note = page.getByTestId('inline-note').first()
    const highlighted = page.locator('[data-highlighted]')
    await expect(highlighted).toHaveCount(0)

    await note.hover()
    await expect(highlighted).toHaveCount(1)
    await expect(highlighted).toContainText('if (attempts > MAX_ATTEMPTS)')

    await note.getByRole('button').first().click()
    await page.mouse.move(0, 0)
    await expect(highlighted).toHaveCount(1)

    await note.getByRole('button').first().click()
    await page.mouse.move(0, 0)
    await expect(highlighted).toHaveCount(0)
  })

  test('"Raise as change-request" starts with the suggestion in a tall box', async ({ page }) => {
    await openReview(page, served.url)
    const note = page.getByTestId('inline-note').first()
    await note.getByRole('button').first().click()
    await note.getByRole('button', { name: 'Raise as change-request' }).click()
    const box = note.getByPlaceholder('What needs to change?')
    await expect(box).toHaveValue('Count only failed attempts, not every login.')
    const height = (await box.boundingBox())!.height
    expect(height).toBeGreaterThan(100)
  })
})

test.describe('note without a suggestion', () => {
  let served: ServedBundle

  test.beforeAll(async () => {
    served = await serveFixtureCopy('enriched', 4331, (_path, review) => {
      review.annotations[0].verdict = 'intended'
      delete review.annotations[0].suggestion
    })
  })

  test.afterAll(async () => {
    await served.stop()
  })

  test('"Raise as change-request" starts empty, not with the whole note', async ({ page }) => {
    await openReview(page, served.url)
    const note = page.getByTestId('inline-note').first()
    await note.getByRole('button').first().click()
    await expect(note.getByTestId('note-suggestion')).toHaveCount(0)
    await note.getByRole('button', { name: 'Raise as change-request' }).click()
    await expect(note.getByPlaceholder('What needs to change?')).toHaveValue('')
  })
})
