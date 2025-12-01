const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './src/index.js',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
      // GitHub Pages를 위한publicPath 설정
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
      // 모든 환경에서 HtmlWebpackPlugin 사용
      new HtmlWebpackPlugin({
        template: './index.html',
        filename: 'index.html',
      }),
    ],
    devServer: {
      port: 3001,
      hot: true,
      static: {
        directory: path.join(__dirname, '.'),
      },
    },
    resolve: {
      extensions: ['.js', '.jsx', '.ts', '.tsx'],
    },
    // 프로덕션 최적화 설정 개선
    optimization: {
      minimize: isProduction,
      splitChunks: {
        chunks: 'all',
        maxInitialRequests: 10,
        maxAsyncRequests: 10,
        cacheGroups: {
          // React 관련 라이브러리
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: 'react',
            chunks: 'all',
            priority: 20,
          },
          // DND 관련 라이브러리
          dnd: {
            test: /[\\/]node_modules[\\/]@dnd-kit[\\/]/,
            name: 'dnd',
            chunks: 'all',
            priority: 15,
          },
          // ExcelJS는 별도 청크로 분리 (지연 로딩용)
          exceljs: {
            test: /[\\/]node_modules[\\/]exceljs[\\/]/,
            name: 'exceljs',
            chunks: 'async',
            priority: 10,
          },
          // 기타 벤더 라이브러리
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
            priority: 5,
          },
          // 공통 컴포넌트
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 1,
            reuseExistingChunk: true,
          },
        },
      },
      // 런타임 청크 분리
      runtimeChunk: {
        name: 'runtime',
      },
    },
    // 성능 경고 임계값 조정
    performance: {
      hints: isProduction ? 'warning' : false,
      maxEntrypointSize: 1024000, // 1MB로 증가
      maxAssetSize: 1024000, // 1MB로 증가
    },
    // 소스맵 설정
    devtool: isProduction ? 'source-map' : 'eval-source-map',
  };
}; 