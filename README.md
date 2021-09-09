PACKES
======

A tool to pack esmodule quickly.

```
npm i -g packes
```

```
NODE_ENV=production packes index.js dist.js --alias="some-pkg=../node_mdoules/some-pkg,some-pkg2=../node_modules/some2" --minify=true
```

```
packes [entryFilePath] [distFilePath] --alias="packages and their paths" ---minify=true
```

`alias` and `minify` should must at the end of file paths

This tool help you to pack the dependencies of a esmodule file into one file, for example:

```
import React, { useState } from 'react'
import { createProxy } from 'ts-fns'

export function useMyHook() {
  const [state] = useState;
  ...
}
```

After use packes to bundle, you will get:

```
const { React, useState, createProxy } = (() => { ... the bundle content } ());

export function useMyHook() {
  const [state] = useState;
  ...
}
```

Look, it will not change the main code section of current file, it will just bundle the dependencies into this file.

Notice that, it can not compile jsx, ts and images, it can only read js/es.
