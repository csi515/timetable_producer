const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : 'bundle.js',
      clean: true,
      // GitHub Pages를 위한 publicPath 설정
      publicPath: isProduction ? '/timetable_producer/' : '/',
    },
    module: {
      rules: [
        {
          test: /\.(js|jsx|ts|tsx)$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', {
                  targets: '> 0.25%, not dead',
                  useBuiltIns: 'usage',
                  corejs: 3
                }], 
                '@babel/preset-react',
                '@babel/preset-typescript'
              ],
            },
          },
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader'],
        },
      ],
    },
    plugins: [
      // 개발 환경에서도 루트의 index.html 사용
      ...(isProduction ? [] : [
        new HtmlWebpackPlugin({
          template: './index.html',
          filename: 'index.html',
        }),
      ]),
    ],
    devServer: {
      port: 3000,
      hot: true,
      static: {
        directory: path.join(__dirname, '.'),
      },
    },
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    // 프로덕션 최적화 설정
    optimization: {
      minimize: isProduction,
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          exceljs: {
            test: /[\\/]node_modules[\\/]exceljs[\\/]/,
            name: 'exceljs',
            chunks: 'all',
            priority: 10,
          },
        },
      },
    },
    // 성능 경고 임계값 조정
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 512000,
      maxAssetSize: 512000,
    },
  };
}; 