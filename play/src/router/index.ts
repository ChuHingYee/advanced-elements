import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/table',
    },
    {
      path: '/table',
      name: 'table',
      component: () => import('../views/TableDemo.vue'),
    },
    {
      path: '/namespace',
      name: 'namespace',
      component: () => import('../views/NamespaceDemo.vue'),
    },
  ],
})

export default router
