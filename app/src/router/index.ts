import { createRouter, createWebHistory } from 'vue-router'
import BlotterView from '../views/BlotterView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'blotter',
      component: BlotterView,
    },
    {
      path: '/status',
      name: 'status',
      component: () => import('../views/StatusView.vue'),
    },
  ],
})

export default router
