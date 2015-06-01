var CronJob = require('cron').CronJob;
var bot = require('./tweetOnce.js').tweetOnce;
new CronJob('00 00 * * * *', function() {
  //tweet once, once an hour
  bot();
}, null, true, 'America/New_York');