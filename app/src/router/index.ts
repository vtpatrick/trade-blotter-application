import { createRouter, createWebHistory } from 'vue-router'
import BlotterView from '../views/BlotterView.vue'
import PositionView from '../views/PositionsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'blotter',
      component: BlotterView,
    },
    {
      path: '/positions',
      name: 'positions',
      component: PositionView,
    },
  ],
})

export default router
