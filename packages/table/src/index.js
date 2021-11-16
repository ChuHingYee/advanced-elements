import AdvTable from './table.js'

const install = function (Vue) {
  Vue.component('AdvTable', AdvTable)
}

if (typeof window !== 'undefined' && window.Vue) {
  install(window.Vue)
}

export { AdvTable }
export default install
