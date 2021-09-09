const path = require('path')
const { DefinePlugin } = require('webpack')

module.exports = function(opts) {
  const { cwd, output, entry, alias: aliasArgs, minify } = opts
  const alias = aliasArgs.split(',').reduce((alias, args) => {
    const [pkg, file] = args.split('=')
    alias[pkg] = path.resolve(cwd, file)
    return alias
  }, {})

  return {
    mode: minify ? 'production' : 'none',
    entry,
    output: {
      path: path.dirname(output),
      filename: path.basename(output),
      library: '__PACKES__',
      libraryTarget: 'var',
    },
    plugins: [
      new DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
      }),
    ],
    resolve: {
      alias,
      modules: [
        path.resolve(cwd, 'node_modules'),
      ],
      symlinks: true,
    },
    optimization: minify ? {
      usedExports: true,
      sideEffects: true,
    } : undefined,
  }
}
