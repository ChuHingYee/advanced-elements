import ElementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'
import AdvTable from '../../packages/table/lib/index'
export default ({
  Vue, // the version of Vue being used in the VuePress app
}) => {
  Vue.use(ElementUI)
  Vue.use(AdvTable)
}
