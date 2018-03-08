var request = require('request')

module.exports = {
  generateQueryString: function (data) {
    var ret = []
    for (var d in data)
      if (data[d])
        ret.push(encodeURIComponent(d) + "=" + encodeURIComponent(data[d]))
    return ret.join("&")
  },

  getRequest: function (url, callback) {
    request.get(url)
      .on('data', function (data) {
        callback(null, data)
      })
      .on('error', function (err) {
        console.log(err)
        callback(err, null)
      })
  }
}
