const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');

module.exports = merge(common, {
   plugins: [
     new UglifyJSPlugin({
        uglifyOptions: {
            warnings: true,
            mangle: false,
            output: {
                comments: false,
                beautify: false
            }
        },        
        sourceMap: false
     }),
     new webpack.DefinePlugin({
       'process.env.NODE_ENV': JSON.stringify('production')
     })
   ]
});