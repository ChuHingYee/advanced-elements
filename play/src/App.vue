<template>
  <div id="app">
    <AdvTable :source="data" :headers="headers" style="width: 100%">
      <!-- <el-table-column prop="name" label="姓名" width="180"> </el-table-column> -->
      <!-- <el-table-column prop="address" label="地址"> </el-table-column> -->
    </AdvTable>
  </div>
</template>

<script>
// import { AdvTable } from '@advanced-element/table/es/index'
export default {
  name: 'App',
  // components: { AdvTable },
  data() {
    return {
      data: [
        {
          name: '姓名1',
          address: '地址1',
          time: new Date().getTime(),
        },
        {
          name: '姓名2',
          address: '地址2',
          time: new Date(),
        },
        {
          name: '姓名3',
          address: '地址3',
          time: new Date(),
        },
        {
          name: '姓名4',
          address: '地址4',
          time: new Date(),
        },
        {
          name: '姓名5',
          address: '地址5',
          time: 1633742317000,
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
          label: '日期',
          prop: 'time',
          width: 120,
          align: 'center',
          format: function (val) {
            return val.time + 'test'
          },
        },
      ],
    }
  },
}
</script>

<style lang="scss"></style>
