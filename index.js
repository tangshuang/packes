#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

const config = require('./webpack.config')
const webpack = require('webpack')
const getArgs = require('process.args')

const [, , input, output = input] = process.argv
const { alias, minify } = getArgs(output)
const cwd = process.cwd()

if (input === output) {
  throw new Error(`input should not equal to output`)
}

const entry = path.resolve(cwd, input)
const dist = path.resolve(cwd, output)

if (!fs.existsSync(entry)) {
  throw new Error(`${entry} does not exist`)
}

const TYPES = {
  IMPORT: 1,
  IMPORT_FROM: 2,
  EXPORT_FROM: 3,
  EXPORT: 4,
}

const content = fs.readFileSync(entry).toString()
const resources = []
const replacedContent = content.replace(
  /import ['"](.*?)['"].*?\n|import([\w\W]+?)from.*?['"](.*?)['"].*?\n|export([\w\W]+?)from.*?['"](.*?)['"].*?\n|export.*?function.*?(.*?)\(.*?\).*?\{.*?\n|export.*?\{([\w\W]+?)\}.*?\n|export (const|var|let) (.*?) =.*?\n/gmi
  , (matched, ...args) => {
  const [importSrc, importFromVars, importFromSrc, exportFromVars, exportFromSrc, exportFn, exportVars, , exportVar] = args
  if (importSrc) {
    resources.push({
      type: TYPES.IMPORT,
      src: importSrc,
    })
  }
  else if (importFromVars) {
    resources.push({
      type: TYPES.IMPORT_FROM,
      src: importFromSrc,
      vars: importFromVars.trim().replace('\n', ''),
    })
  }
  else if (exportFromVars) {
    resources.push({
      type: TYPES.EXPORT_FROM,
      src: exportFromSrc,
      vars: exportFromVars.trim().replace('\n', ''),
    })
  }
  else if (exportFn) {
    resources.push({
      type: TYPES.EXPORT,
      vars: exportFn.replace('*', '').trim(),
    })
    return matched
  }
  else if (exportVars) {
    resources.push({
      type: TYPES.EXPORT,
      vars: exportFn.trim().replace('\n', ''),
    })
    return matched
  }
  else if (exportVar) {
    resources.push({
      type: TYPES.EXPORT,
      vars: exportFn.trim(),
    })
    return matched
  }
  return ''
})

const entryContent = resources.map((resource) => {
  const { type, src: relative, vars } = resource
  const src = relative[0] === '.' ? path.resolve(cwd, relative) : relative
  if (type === TYPES.IMPORT) {
    return `import '${src}';`
  }
  else if (type === TYPES.IMPORT_FROM) {
    // import * as A from 'aa'
    if (vars.indexOf('{') === -1 && vars.indexOf(' * ') > -1) {
      const [, name] = vars.split(' as ').map(item => item.trim())
      return `export {${name}} from '${src}';`
    }
    // import Some from './some.js'
    else if (vars.indexOf('{') === -1) {
      return `export {${vars}} from '${src}';`
    }
    // import { a, b } from 'xx'
    else if (vars.indexOf('{') === 0) {
      return `export ${vars} from '${src}';`
    }
    // import Def, { a, b } from 'xx'
    else if (vars.indexOf('{') > 0) {
      const index = vars.indexOf(',')
      const defaultVar = vars.substr(0, index)
      const exportVars = vars.substring(index + 1)
      const exportStr = exportVars.trim()
      const exportItems = exportStr.substring(1, exportStr.length - 1)
      return `export {${defaultVar},${exportItems}} from '${src}';`
    }
  }
  else if (type === TYPES.EXPORT_FROM) {
    // export * as A from 'aa'
    if (vars.indexOf('{') === -1 && vars.indexOf(' * ') > -1) {
      const [, name] = vars.split(' as ').map(item => item.trim())
      return `export {${name}} from '${src}';`
    }
    // export { a, b } from 'xx'
    else if (vars.indexOf('{') === 0) {
      return `export ${vars} from '${src}';`
    }
  }
}).join('\n')
const entryFile = path.resolve(__dirname, '__entry__.js')
fs.writeFileSync(entryFile, entryContent)

const importVars = []
resources.forEach((resource) => {
  const { type, vars } = resource
  if (type === TYPES.IMPORT_FROM) {
    // import * as A from 'aa'
    if (vars.indexOf('{') === -1 && vars.indexOf(' * ') > -1) {
      const [, name] = vars.split(' as ').map(item => item.trim())
      importVars.push(name)
    }
    // import Some from './some.js'
    else if (vars.indexOf('{') === -1) {
      importVars.push(vars)
    }
    // import { a, b } from 'xx'
    else if (vars.indexOf('{') === 0) {
      const varsStr = vars.substring(1, vars.length - 1)
      const varNames = varsStr.split(',').map(item => item.trim())
      importVars.push(...varNames)
    }
    // import Def, { a, b } from 'xx'
    else if (vars.indexOf('{') > 0) {
      const index = vars.indexOf(',')
      const defaultVar = vars.substr(0, index)
      const exportVars = vars.substring(index + 1)
      const exportStr = exportVars.trim()
      const exportItems = exportStr.substring(1, exportStr.length - 1)
      const varNames = exportItems.split(',').map(item => item.trim())
      importVars.push(defaultVar, ...varNames)
    }
  }
  else if (type === TYPES.EXPORT_FROM) {
    // export * as A from 'aa'
    if (vars.indexOf('{') === -1 && vars.indexOf(' * ') > -1) {
      const [, name] = vars.split(' as ').map(item => item.trim())
      importVars.push(name)
    }
    // export { a, b } from 'xx'
    else if (vars.indexOf('{') === 0) {
      const varsStr = vars.substring(1, vars.length - 1)
      const varNames = varsStr.split(',').map(item => item.trim())
      importVars.push(...varNames)
    }
  }
  else if (type === TYPES.EXPORT) {
    const varNames = vars.split(',').map(item => item.trim())
    importVars.push(...varNames)
  }
})

const outputFile = path.resolve(__dirname, '__output__.js')

const webpackConfig = config({
  entry: entryFile,
  output: outputFile,
  cwd,
  alias,
  minify,
})

const removeFiles = () => {
  fs.unlinkSync(entryFile)
  fs.unlinkSync(outputFile)
}

const compiler = webpack(webpackConfig)
compiler.run((err, stats) => {
  if (err) {
    removeFiles()
    throw err
  }

  const info = stats.toJson()
  let errFlag = false

  if (stats.hasErrors()) {
    console.error(info.errors)
    errFlag = true
  }

  if (stats.hasWarnings()) {
    console.warn(info.warnings)
  }

  if (errFlag) {
    removeFiles()
    compiler.close()
    return
  }

  compiler.close(() => {})

  const outputContent = fs.readFileSync(outputFile).toString()
  const distContent = `${outputContent};\nconst {${importVars.join(',')}} = __PACKES__;\n${replacedContent}`
  fs.writeFileSync(path.resolve(dist), distContent)

  console.log('============ pack success ============')
})
