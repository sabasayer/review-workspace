import type { RouteRecordRaw } from 'vue-router'
import DiffReviewView from './views/DiffReviewView.vue'

export const routes: RouteRecordRaw[] = [{ path: '/', name: 'diff-review', component: DiffReviewView }]
