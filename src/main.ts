import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart, LineChart } from 'echarts/charts'
import {
  TooltipComponent, LegendComponent, GridComponent,
  TitleComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import App from './App.vue'
import router from './router'
import { registerEChartsTheme } from './style/echarts-theme'
import './style/base.css'

use([CanvasRenderer, PieChart, BarChart, LineChart, TooltipComponent, LegendComponent, GridComponent, TitleComponent])
registerEChartsTheme()

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.component('VChart', VChart)
app.mount('#app')
