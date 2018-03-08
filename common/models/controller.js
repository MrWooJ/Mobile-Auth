var cron = require('cron')
var app = require('../../server/server')
var createError = require('http-errors')
var utility = require('../../public/utility')

var verificationStatus = require('../../config/verificationStatus.json')

var verifiedAdditionTime = 3 * 24 * 60 * 60 * 1000

module.exports = function (controller) {

  var checkSuspendStatus = cron.job("*/10 * * * * *", function () {
    var basic = controller.app.models.basic
    var time = Math.floor((new Date).getTime())
    basic.find({
      where: {
        'status': verificationStatus.suspended
      },
      limit: 50000
    }, function (err, basicList) {
      if (err)
        console.error(err)
      for (var i = 0; i < basicList.length; i++) {
        var model = basicList[i]
        if (Number(model.date) + Number(model.ttl) < time) {
          var data = {
            tryCount: 5,
            date: time,
            status: verificationStatus.ready
          }
          model.updateAttributes(data, function (err, basicInst) {
            if (err)
              console.error(err)
          })
        }
      }
    })
  })

  checkSuspendStatus.start()

  var checkPendingStatus = cron.job("*/10 * * * * *", function () {
    var basic = controller.app.models.basic
    var time = Math.floor((new Date).getTime())
    basic.find({
      where: {
        'status': verificationStatus.pending
      },
      limit: 50000
    }, function (err, basicList) {
      if (err)
        console.error(err)
      for (var i = 0; i < basicList.length; i++) {
        var model = basicList[i]
        if (Number(model.date) + Number(model.ttl) < time) {
          var data = {
            tryCount: 5,
            date: time,
            status: verificationStatus.ready
          }
          model.updateAttributes(data, function (err, basicInst) {
            if (err)
              console.error(err)
          })
        }
      }
    })
  })

  checkPendingStatus.start()

  var checkVerifiedStatus = cron.job("*/10 * * * * *", function () {
    var basic = controller.app.models.basic
    var time = Math.floor((new Date).getTime())
    basic.find({
      where: {
        'status': verificationStatus.verified
      },
      limit: 50000
    }, function (err, basicList) {
      if (err)
        console.error(err)
      for (var i = 0; i < basicList.length; i++) {
        var model = basicList[i]
        if (Number(model.date) + verifiedAdditionTime < time) {
          var data = {
            tryCount: 5,
            date: time,
            status: verificationStatus.ready
          }
          model.updateAttributes(data, function (err, basicInst) {
            if (err)
              console.error(err)
          })
        }
      }
    })
  })

  checkVerifiedStatus.start()

  function getRandomInt(min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min)) + min
  }

  function sendSMS(mobileNumber, randomPassword, cb) {

  }

  function invokePassword(mobileNumber, cb) {
    var basic = controller.app.models.basic
    basic.find({
      'where': {
        'mobileNumber': mobileNumber
      },
      limit: 50000
    }, function (err, modelArrays) {
      if (err)
        return cb(err)
      console.log(modelArrays.length)
      var rand = getRandomInt(125000, 999999)
      var time = Math.floor((new Date).getTime())
      var data = {
        mobileNumber: mobileNumber,
        password: rand,
        date: time,
        status: verificationStatus.pending
      }
      if (modelArrays.length <= 0) {
        basic.create(data, function (err, basicModel) {
          if (err)
            return cb(err)
          sendSMS(mobileNumber, rand, function (err, result) {
            if (err)
              return cb(err)
            return cb(null, basicModel)
          })
        })
      } else {
        var model = modelArrays[0]
        if (model.status === verificationStatus.suspended)
          return cb(createError(423))
        if (model.status === verificationStatus.verified)
          return cb(null, model)
        model.updateAttributes(data, function (err, basicUpdatedModel) {
          if (err)
            return cb(err)
          sendSMS(mobileNumber, rand, function (err, result) {
            if (err)
              return cb(err)
            return cb(null, basicUpdatedModel)
          })
        })
      }
    })
  }

  function enterPassword(mobileNumber, password, cb) {
    var basic = controller.app.models.basic
    basic.find({
      'where': {
        'mobileNumber': mobileNumber
      },
      limit: 50000
    }, function (err, modelArrays) {
      if (err)
        return cb(err)
      if (modelArrays.length <= 0)
        return cb(createError(404))
      else {
        var model = modelArrays[0]
        if (model.status === verificationStatus.suspended)
          return cb(createError(423))
        if (model.status === verificationStatus.verified)
          return cb(null, model)
        if (model.status === verificationStatus.ready)
          return cb(createError(404))
        var newTryCount = Number(model.tryCount) - 1
        var time = Math.floor((new Date).getTime())
        if (newTryCount <= 0) {
          var data = {
            status: verificationStatus.suspended,
            date: time
          }
          model.updateAttributes(data, function (err, basicUpdatedModel) {
            if (err)
              return cb(err)
            return cb(createError(423))
          })
        }
        var expireDate = Number(model.date) + Number(model.ttl)
        if (time > expireDate) {
          var data = {
            tryCount: 5,
            date: time,
            status: verificationStatus.ready
          }
          model.updateAttributes(data, function (err, basicUpdatedModel) {
            if (err)
              return cb(err)
            return cb(createError(404))
          })
        }
        if (password !== model.password) {
          model.updateAttribute('tryCount', newTryCount, function (err, basicUpdatedModel) {
            if (err)
              return cb(err)
            return cb(createError(401))
          })
        } else {
          var data = {
            status: verificationStatus.verified,
            date: time
          }
          model.updateAttributes(data, function (err, basicUpdatedModel) {
            if (err)
              return cb(err)
            return cb(null, basicUpdatedModel)
          })
        }
      }
    })
  }

  controller.sendCode = function (mobileNumber, callback) {
    invokePassword(mobileNumber, function (err, result) {
      return callback(err, result)
    })
  }

  controller.remoteMethod('sendCode', {
    description: 'Enter the mobile number in order to receive the password code.',
    accepts: [{
      arg: 'mobileNumber',
      type: 'string',
      required: true,
      http: {
        source: 'path'
      }
    }],
    http: {
      path: '/sendCode/:mobileNumber',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'object',
      root: true
    }
  })

  controller.enterCode = function (mobileNumber, password, callback) {
    enterPassword(mobileNumber, password, function (err, result) {
      return callback(err, result)
    })
  }

  controller.remoteMethod('enterCode', {
    description: 'Enter the mobile number and provided password to check authentication',
    accepts: [{
        arg: 'mobileNumber',
        type: 'string',
        required: true,
        http: {
          source: 'path'
        }
      },
      {
        arg: 'password',
        type: 'string',
        required: true,
        http: {
          source: 'path'
        }
      }
    ],
    http: {
      path: '/enterCode/:mobileNumber/:password',
      verb: 'POST',
      status: 200,
      errorStatus: 400
    },
    returns: {
      type: 'object',
      root: true
    }
  })

}
