# @advanced-elements/config-provider

> 🌐 Languages: **中文** · [English](./README.en.md)

全局配置提供者，为 `@advanced-elements/*` 系列组件提供全局默认配置（locale、size、zIndex 等），通常与 `@advanced-elements/table` 配合使用。

## Install

```bash
pnpm add @advanced-elements/config-provider
```

## 使用

```ts
import { createApp } from 'vue'
import { AdvConfigProvider } from '@advanced-elements/config-provider'

const app = createApp(App)
app.use(AdvConfigProvider)
```

```vue
<template>
  <AdvConfigProvider :locale="zhCn" :size="'small'">
    <AdvTable :columns="columns" :data="data" />
  </AdvConfigProvider>
</template>
```

## License

MIT © ChuHingYee
