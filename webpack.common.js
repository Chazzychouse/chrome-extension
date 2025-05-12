const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const HtmlPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = {
  entry: {
    popup: path.resolve('src/popup/index.tsx'),
    background: path.resolve('src/background/index.ts'),
    contentScript: path.resolve('src/contentScript/index.ts'),
    sidebar: path.resolve('src/popup/sidebar.css')
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                '@babel/preset-env',
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript'
              ]
            }
          }
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.(jpg|jpeg|png|woff|woff2|eot|ttf|svg)$/,
        type: 'asset/resource'
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  plugins: [
    new CleanWebpackPlugin({
      cleanStaleWebpackAssets: false,
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve('src/static'),
          to: path.resolve('dist'),
        }
      ]
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
    new Dotenv({
      systemvars: true, // load all system variables as well
      safe: true // load .env.example as well
    }),
    ...getHtmlPlugins([
      'popup'
    ]),
  ],
  output: {
    filename: '[name].js',
    path: path.resolve('dist'),
    publicPath: './'
  },
  optimization: {
    minimize: true,
    splitChunks: false
  }
}

function getHtmlPlugins(chunks) {
  return chunks.map(chunk => new HtmlPlugin({
    title: 'Chazzy Extension',
    filename: `${chunk}.html`,
    chunks: [chunk],
    template: chunk === 'popup' ? path.resolve('src/popup/popup.html') : undefined,
    inject: 'body'
  }))
} 