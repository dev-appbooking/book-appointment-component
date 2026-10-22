const path = require('path');

module.exports = {
  entry: {
    appBookingPublic: path.join(__dirname, "src", "AppBookingPublic.jsx"),
    appBookingDesks: path.join(__dirname, "src", "AppBookingDesks.jsx"),
    appBookingEvents: path.join(__dirname, "src", "AppBookingEvents.jsx")
  },
  mode: "development",
  output: {
    filename: '[name].js',
    path:path.resolve(__dirname, "public/js/"),
    libraryTarget: 'umd',
    library: '[name]',
    umdNamedDefine: true
  },
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM'
  },
  devServer: {
    devMiddleware: {
        index: true,
        publicPath: '/js/',
        serverSideRender: true,
        writeToDisk: false
    },
    compress: false,
    hot: false,
    liveReload: false,
    port: 3001,
  },
  module: {
    rules: [
      {
        test: /\.?(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ['@babel/preset-react'],
            plugins: [ 
                    ['@babel/plugin-transform-react-jsx'],
                    ['@babel/plugin-proposal-decorators', {legacy: true}],
                    ["@babel/plugin-transform-class-properties", { "loose": true }]
                    
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.svg$/,
        use: { 
                loader: 'svg-url-loader',
                options: {
                    limit: 10000
                }
            }
      }
    ]
  }
}