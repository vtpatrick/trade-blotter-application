import './assets/main.css'
import './grid/grid.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community'

import App from './App.vue'
import router from './router'

ModuleRegistry.registerModules([AllCommunityModule])

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
