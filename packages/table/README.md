# @advanced-elements/table

## AdvTable Props

| Properties    | Description                      | Type                | Default      |
| ------------- | -------------------------------- | ------------------- | ------------ |
| source        | 表格数据来源                     | `array or function` | []           |
| size          | 组件尺寸                         | `string`            | `small`      |
| auto          | 是否表格构建后立即获取数据       | `boolean`           | true         |
| isFreeze      | 是否对表格数据进行 freeze 处理   | `boolean`           | true         |
| isRecord      | 当前路由是否记录当前数据分页数据 | `boolean`           | false        |
| isManual      | 是否手动获取下一页数据           | `boolean`           | false        |
| openSticky    | 是否分页组件设置 Sticky 属性     | `boolean`           | true         |
| clientHeight  | 表格组件高度                     | `number`            | 450          |
| totalCountKey | 分页组件当前页数相对应的 Key     | `string`            | `totalCount` |
| totalPageKey  | 分页组件总页数相对应的 Key       | `string`            | `totalPage`  |
| headers       | 表格组件 headers                 | `array`             | []           |

## Install

Using npm:

```bash
$ npm install --save @advanced-elements/table
```

or using yarn:

```bash
$ yarn add @advanced-elements/table
```

or using pnpm:

```bash
$ pnpm add @advanced-elements/table
```
