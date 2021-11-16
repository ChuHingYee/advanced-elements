---
pageClass: custom-table-class
---

# adv-table 表格

封装于 el-table 和 el-pagination 组件，在不破坏其原有功能基础上,解决表格样板代码过多问题。

## 渲染表头方式

### 普通渲染表头

::: demo

```html
<template>
  <adv-table :source="data" :headers="headers" style="width: 100%">
    <el-table-column prop="name" label="姓名"> </el-table-column>
    <el-table-column prop="address" label="地址"> </el-table-column>
    <el-table-column label="格式化" width="120" align="center">
      <template slot-scope="scope">
        <span>{{ scope.row.name }}test</span>
      </template>
    </el-table-column>
  </adv-table>
</template>

<script>
  export default {
    data() {
      return {
        data: [
          {
            name: '姓名1',
            address: '地址1',
          },
          {
            name: '姓名2',
            address: '地址2',
          },
          {
            name: '姓名3',
            address: '地址3',
          },
          {
            name: '姓名4',
            address: '地址4',
          },
          {
            name: '姓名5',
            address: '地址5',
          },
        ],
      }
    },
  }
</script>
```

:::

### 通过 Headers 控制表头

::: demo

```html
<template>
  <adv-table :source="data" :headers="headers" style="width: 100%"> </adv-table>
</template>

<script>
  export default {
    data() {
      return {
        data: [
          {
            name: '姓名1',
            address: '地址1',
          },
          {
            name: '姓名2',
            address: '地址2',
          },
          {
            name: '姓名3',
            address: '地址3',
          },
          {
            name: '姓名4',
            address: '地址4',
          },
          {
            name: '姓名5',
            address: '地址5',
          },
        ],
        headers: [
          {
            label: '姓名',
            prop: 'name',
          },
          {
            label: '地址',
            prop: 'address',
          },
          {
            label: '格式化',
            prop: 'formatName',
            width: 120,
            align: 'center',
            format: function (val) {
              return val.name + 'test'
            },
          },
        ],
      }
    },
  }
</script>
```

:::

## 数据来源为数组

### 用于手动控制数据输入

::: demo

```html
<template>
  <adv-table :source="data" style="width: 100%">
    <el-table-column prop="name" label="姓名" width="180"> </el-table-column>
    <el-table-column prop="address" label="地址"> </el-table-column>
  </adv-table>
</template>

<script>
  export default {
    data() {
      return {
        data: [
          {
            name: '姓名1',
            address: '地址1',
          },
          {
            name: '姓名2',
            address: '地址2',
          },
          {
            name: '姓名3',
            address: '地址3',
          },
          {
            name: '姓名4',
            address: '地址4',
          },
          {
            name: '姓名5',
            address: '地址5',
          },
        ],
      }
    },
  }
</script>
```

:::

## 数据来源为请求方法

### 用于自动请求

::: demo

```html
<template>
  <div>
    <adv-table :source="load" style="width: 100%">
      <el-table-column prop="name" label="姓名" width="180"></el-table-column>
      <el-table-column prop="address" label="地址"> </el-table-column>
    </adv-table>
  </div>
</template>

<script>
  export default {
    data() {
      return {
        data: [
          {
            name: '姓名1',
            address: '地址1',
          },
          {
            name: '姓名2',
            address: '地址2',
          },
          {
            name: '姓名3',
            address: '地址3',
          },
          {
            name: '姓名4',
            address: '地址4',
          },
          {
            name: '姓名5',
            address: '地址5',
          },
        ],
      }
    },
    methods: {
      load() {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              content: this.data,
              totalCount: 20,
              totalPage: 300,
            })
          }, 500)
        })
      },
    },
  }
</script>
```

:::

### 用于手动请求

::: demo

```html
<template>
  <div>
    <adv-table :source="load" style="width: 100%" ref="table" :auto="false">
      <el-table-column prop="name" label="姓名" width="180"> </el-table-column>
      <el-table-column prop="address" label="地址"> </el-table-column>
      <template slot="footer">
        <el-button @click="refresh">获取数据</el-button>
      </template>
    </adv-table>
  </div>
</template>

<script>
  export default {
    data() {
      return {
        data: [
          {
            name: '姓名1',
            address: '地址1',
          },
          {
            name: '姓名2',
            address: '地址2',
          },
          {
            name: '姓名3',
            address: '地址3',
          },
          {
            name: '姓名4',
            address: '地址4',
          },
          {
            name: '姓名5',
            address: '地址5',
          },
        ],
      }
    },
    methods: {
      load() {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              content: this.data,
              totalCount: 20,
              totalPage: 300,
            })
          }, 500)
        })
      },
      refresh() {
        this.$refs.table.refresh()
      },
    },
  }
</script>
```

:::

### 用于手动触发加载更多

::: demo

```html
<template>
  <adv-table :source="load" style="width: 100%" :isManual="true">
    <el-table-column prop="name" label="姓名" width="180"> </el-table-column>
    <el-table-column prop="address" label="地址"> </el-table-column>
  </adv-table>
</template>

<script>
  export default {
    data() {
      return {
        data: [
          {
            name: '姓名1',
            address: '地址1',
          },
          {
            name: '姓名2',
            address: '地址2',
          },
          {
            name: '姓名3',
            address: '地址3',
          },
          {
            name: '姓名4',
            address: '地址4',
          },
          {
            name: '姓名5',
            address: '地址5',
          },
        ],
      }
    },
    methods: {
      load() {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              content: this.data,
              totalCount: 20,
              totalPage: 300,
            })
          }, 500)
        })
      },
    },
  }
</script>
```

:::
