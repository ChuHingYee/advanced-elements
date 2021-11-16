import { Table, Button, Pagination } from 'element-ui'
import './table.scss'

export default {
  name: 'AdvTable',
  components: {
    Table,
    Button,
    Pagination,
  },
  data() {
    return {
      dataIsArray: false,
      localPageIndex: 1,
      localPageSize: 10,
      localTotalCount: 0,
      localTotalPage: 0,
      localPageSizesList: [10, 20, 30],
      localData: [],
      localLoading: false,
      isSticky: false,
    }
  },
  props: Object.assign({}, Table.props, {
    source: {
      type: [Function, Array],
      default: () => {},
    },
    size: {
      type: String,
      default: 'small',
    },
    auto: {
      type: Boolean,
      default: true,
    },
    isFreeze: {
      type: Boolean,
      default: true,
    },
    border: {
      type: Boolean,
      default: false,
    },
    autoPage: {
      type: Boolean,
      default: true,
    },
    isRecord: {
      type: Boolean,
      default: false,
    },
    isManual: {
      type: Boolean,
      default: false,
    },
    openSticky: {
      type: Boolean,
      default: true,
    },
    clientHeight: {
      type: Number,
      default: 450,
    },
    totalCountKey: {
      type: String,
      default: 'totalCount',
    },
    totalPageKey: {
      type: String,
      default: 'totalPage',
    },
    headers: {
      type: Array,
      default: () => [],
    },
  }),
  watch: {
    clientHeight() {
      this.checkIsSticky()
    },
    source: {
      immediate: true,
      deep: true,
      handler: function (val) {
        if (Array.isArray(val)) {
          this.localData = val
          this.dataIsArray = true
        } else {
          if (this.auto) {
            this.loadData()
          }
        }
      },
    },
  },
  methods: {
    loadData(params) {
      return new Promise((resolve) => {
        const { isFreeze, isManual, totalCountKey, totalPageKey } = this
        const _params = {
          page: this.localPageIndex - 1,
          size: this.localPageSize,
          ...params,
        }
        this.localLoading = true
        this.source(_params)
          .then((res) => {
            this.localTotalCount = res[totalCountKey]
            this.localTotalPage = res[totalPageKey]
            // 根据isFreeze判断是否freeze数据
            let _list = []
            if (isFreeze) {
              _list = Object.freeze(res.content)
            } else {
              _list = res.content
            }
            if (isManual) {
              this.localData = this.localData.concat(_list)
            } else {
              this.localData = _list
            }
            this.$emit('update-total', res[totalCountKey])
            this.checkIsSticky()
            resolve()
          })
          .finally(() => {
            this.localLoading = false
          })
      })
    },
    handleCurrentChange(val) {
      this.localPageIndex = val
      if (this.isRecord && !this.isManual) {
        this.setPageLog(val, this.localPageSize)
      }
      if (!this.dataIsArray) {
        this.loadData()
      }
      this.$emit('change-page', {
        page: val,
        size: this.localPageSize,
      })
    },
    handleSizeChange(val) {
      this.localPageSize = val
      this.localPageIndex = 1
      if (this.isRecord) {
        this.setPageLog(1, val)
      }
      if (!this.dataIsArray) {
        this.loadData()
      }
      this.$emit('change-page', {
        page: 1,
        size: val,
      })
    },
    resetTableSelect() {
      this.$refs.table.clearSelection()
    },
    /**
     * 表格外部筛选方法
     * @param
     */
    refresh(refresh = false) {
      if (!this.dataIsArray) {
        this.localData = []
        if (refresh) {
          this.localPageIndex = 1
          if (this.isRecord) {
            this.setPageLog(1, this.localPageSize)
          }
        } else {
          if (this.isRecord && this.$route) {
            const { p, s } = this.$route.query
            if (!p) {
              this.localPageIndex = 1
            }
            if (!s) {
              this.localPageSize = 10
            }
          }
        }
        this.loadData()
      }
    },
    /**
     * 表格外部设置表格loading
     * @param Boolean bool
     */
    setLoading(flag) {
      this.localLoading = flag
    },
    setPageLog(page, count) {
      const { path, query } = this.$route
      this.$router.replace({
        path,
        query: {
          ...query,
          p: page,
          s: count,
        },
      })
    },
    doLayout() {
      this.$nextTick(() => {
        this.$refs.table.doLayout()
      })
    },
    loadDataByManual() {
      const { localTotalPage, localPageIndex } = this
      if (localPageIndex !== localTotalPage && localTotalPage !== 0) {
        this.handleCurrentChange(localPageIndex + 1)
      } else {
        this.handleCurrentChange(localPageIndex)
      }
    },
    checkIsSticky() {
      this.$nextTick(() => {
        if (this.$refs.page && this.clientHeight && this.openSticky) {
          const rect = this.$refs.page.getBoundingClientRect()
          if (rect.top > this.clientHeight - 45) {
            this.isSticky = true
          }
        }
      })
    },
  },

  mounted() {
    if (this.isRecord && !this.isManual && this.$route) {
      const { p, s } = this.$route.query
      if (p) {
        this.localPageIndex = p - 0
      }
      if (s) {
        this.localPageSize = s - 0
      }
    }
  },

  // eslint-disable-next-line no-unused-vars
  render(h) {
    const {
      isManual,
      isSticky,
      localLoading,
      $listeners,
      $scopedSlots,
      $slots,
      localPageIndex,
      localTotalPage,
      localData,
      size,
      headers,
    } = this
    const props = {}
    const localKeys = Object.keys(this.$data)
    Object.keys(Table.props).forEach((k) => {
      const localKey = `local${k.substring(0, 1).toUpperCase()}${k.substring(
        1
      )}`
      if (localKeys.includes(localKey)) {
        props[k] = this[localKey]
        return props[k]
      }
      props[k] = this[k]
      return props[k]
    })
    const tableColumns = headers.map((props) => {
      return (
        <el-table-column
          key={props.prop}
          {...{
            props,
            scopedSlots: {
              default: (scope) => {
                const { row } = scope
                const { prop, format } = props
                return <div>{format ? format(row) : row[prop]}</div>
              },
            },
          }}
        ></el-table-column>
      )
    })
    const CustomTable = (
      <el-table
        class="table-main"
        ref="table"
        vLoading={localLoading}
        {...{ props, scopedSlots: { ...$scopedSlots } }}
        on={$listeners}
      >
        {tableColumns}
      </el-table>
    )
    return (
      <div class="table">
        {CustomTable}
        {!isManual && (
          <div
            ref="page"
            class={{
              'table-page': true,
              'table-page__sticky': isSticky,
            }}
          >
            <div>{$slots.footer}</div>
            {this.localTotalCount !== 0 && (
              <el-pagination
                ref="pagination"
                on-size-change={this.handleSizeChange}
                on-current-change={this.handleCurrentChange}
                current-page={this.localPageIndex}
                page-sizes={this.localPageSizesList}
                page-size={this.localPageSize}
                layout="total,sizes, prev, pager, next,jumper"
                total={this.localTotalCount}
              />
            )}
          </div>
        )}
        {isManual && (
          <div
            ref="page"
            class={{
              'table-page': true,
              'table-manual': true,
              'table-page__sticky': isSticky,
            }}
          >
            {localPageIndex !== localTotalPage && localPageIndex !== 0 && (
              <el-button
                size={size}
                icon="el-icon-refresh-right"
                loading={localLoading}
                onClick={this.loadDataByManual.bind(this)}
              >
                加载更多
              </el-button>
            )}
            {localPageIndex === localTotalPage &&
              localPageIndex !== 0 &&
              localData.length !== 0 && (
                <div class="table-manual__btn">没有更多了</div>
              )}
          </div>
        )}
      </div>
    )
  },
}
