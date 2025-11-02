const path = require('path');

module.exports = {
  entry: path.join(__dirname, "src", "AppBookingPublic.jsx"),
  mode: "production",
  output: {
    filename: 'appBookingPublic.js',
    path:path.resolve(__dirname, "public/js/"),
    libraryTarget: 'umd',
    library: 'appBookingPublic',
    umdNamedDefine: true
  },
  externals: {
    'react': 'React',
    'react-dom': 'ReactDOM'
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