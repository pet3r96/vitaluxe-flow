// =====================================================
// PHASE 3: LOAD TEST HELPER FUNCTIONS
// =====================================================
// This file provides helper functions for Artillery load tests
// =====================================================

module.exports = {
  // Generate random UUID v4
  randomUUID: function(context, events, done) {
    context.vars.randomUUID = require('crypto').randomUUID();
    return done();
  },

  // Generate random string of specified length
  randomString: function(context, events, done) {
    const length = 50;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    context.vars.randomString = result;
    return done();
  },

  // Generate random integer between min and max
  randomInt: function(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },

  // Log response time for debugging
  logResponseTime: function(requestParams, response, context, ee, next) {
    if (response.timings) {
      console.log(`[${requestParams.url}] Response time: ${response.timings.response}ms`);
    }
    return next();
  },

  // Check if response is successful
  checkSuccess: function(requestParams, response, context, ee, next) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      ee.emit('counter', 'test.success', 1);
    } else if (response.statusCode === 429) {
      // Rate limited - expected for some functions
      ee.emit('counter', 'test.rate_limited', 1);
    } else {
      ee.emit('counter', 'test.failure', 1);
    }
    return next();
  }
};
