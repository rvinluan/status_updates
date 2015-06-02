var rita = require('rita');
var lexicon = rita.RiLexicon();

var Twit = require('twit');
var T = new Twit(require('./config.js'));

var CronJob = require('cron').CronJob;
new CronJob('00 0,30 * * * *', function() {
  //tweet once, once an hour
  searchJust();
}, null, true, 'America/New_York');

function tweet(sts) {
  T.post('statuses/update', { status: sts }, function(err, data, response) {
    if(err) {
      console.log("There was an err:"+err);
    }
  })
}

function handleErrors(err, data) {
  if(err) {
    console.log("There was an err:"+err);
    return 1;
  }
  if(!data || !data.statuses || data.statuses.length == 0) { 
    console.log("No tweets found for chosen verb.");
    return 2; 
  }
  return 0;
}

//the 'I Just...' part
function searchJust() {
  var finalTweet = "I just ";
  var verb = lexicon.randomWord("vbd");
  console.log("verb::"+verb);
  var query = ("%22I just " + verb + "%22");
  T.get('search/tweets', { q: query, count: 1 }, function(err, data, response) {
    if (handleErrors(err, data) == 2) {
      searchJust();
      return;
    }
    if (handleErrors(err, data)) {return;}
    for(var i = 0; i < data.statuses.length; i++) {
      var text = data.statuses[i].text;
      var op = getOperative(text.toLowerCase(), verb.toLowerCase());
      console.log("text::"+text);
      // console.log("operative::"+op);

      //trim op for whitespace
      if(op.charAt(op.length - 1) == " ") {
        op = op.slice(0, -1);
      }
      finalTweet += op;
      //the 'in case you were wondering part'
      var icyww = searchInCase(finalTweet);
    }
  })
}

//searches for tweets of the form 'x is fun'
//will also use other emotions like awesome or lame in place of fun
function searchInCase(finalTweet) {
  var emotions = [
    'fun', 'lame', 'awesome', 'shitty', 'great',
    'amazing', 'stupid', 'boring', 'eventful',
    'perfect', 'unbelievable', 'ridiculous',
    'intense', 'crazy', 'good', 'exciting', 'sad'
  ];
  var emotion = emotions[Math.floor(Math.random() * emotions.length)];
  T.get('search/tweets', { q: "%22is "+emotion+"%22 -RT", count: 10 }, function(err, data, response) {
    if (handleErrors(err, data)) {return;}
    console.log('\033[91m');  
    var finalag;
    for(var i = 0; i < data.statuses.length; i++) {
      console.log(data.statuses[i].text);
      var icyww = data.statuses[i].text;
      var activity = getActivity(icyww, emotion);
      var ag = getAcceptableGrammar(activity);
      if (ag) {
        finalag = ag;
        console.log('\033[32mPASS: ' + ag + '\033[91m');
        // break;
      } else {
        console.log('\033[34m' + activity.words.join(" ") + '\033[91m');
        continue;
      }
    }
    console.log('\033[0m');  
    //we should have the final tweet now
    if(finalag) {
      finalTweet += ", in case you were wondering how " + finalag + " is going";
    }
    console.log("FINAL TWEET ============================("+finalTweet.length+")!");
    console.log(finalTweet);
    tweet(finalTweet);
  });
}

//find the part of a tweet that follows 'I just [verbed]'
function getOperative(str, verb) {
  var verbIndex = str.indexOf(verb);
  var restOfString = str.substr(verbIndex);
  //match restOfString to a regex that identifies thought endings (see function below)
  var matches = thoughtEndings().exec(restOfString);
  if(matches && matches.index) {
    // console.log("regex matches::"+matches[0]);
    // console.log("regex match index::"+matches.index);
    return restOfString.substring(0,matches.index);
  }
  else
    return restOfString;
}

//find the part of the tweet that precedes 'is [emotion]'
function getActivity(tweet, emotion) {
  var tokens = tweet.toLowerCase().split(" ");
  var isIndex = -1;
  var newPhraseArray = [];
  var posArray = [];
  var returnObject = {
    words: [],
    pos: []
  }
  //loop through and find the 'is [emotion]'
  for(var i = 0; i < tokens.length; i++) {
    if( i >= tokens.length - 1) {
      break; //stop the loop now before even doing the check
    }
    if(
      tokens[i].indexOf("is") !== -1 &&
      tokens[i+1].indexOf(emotion) !== -1
    ) {
      isIndex = i;
    }
  }

  if(isIndex == -1) {
    return returnObject;
  }

  //let's look at the 3 words before the "is [emotion]"
  //some of these will be undefined, that's ok
  for(var i = 0; i < 3; i++) {
    var text = tokens[isIndex - (3 - i)];
    //filter out usernames and links
    if(!text || text.charAt(0) == '@' || text.indexOf('http') !== -1) {
      newPhraseArray[i] = new rita.RiString("");
    } else {    
      newPhraseArray[i] = new rita.RiString(text);
    }
    posArray[i] = newPhraseArray[i].pos()[0];
  }
  // console.log('\033[35m');
  // console.log(newPhraseArray);
  // console.log(posArray);
  // console.log('\033[0m');

  var threewordphrase = newPhraseArray.map(function (value, index) {
    return value._text;
  })

  //returns the 3 words and their parts of speech
  return {
    words: threewordphrase,
    pos: posArray
  }
}

function randomGerund() {
  var baseVerb = lexicon.randomWord("vb");
  return rita.RiTa.getPresentParticiple(baseVerb);
}

//outputs a regex that checks for things that can be considered to be pauses or endings in thought
function thoughtEndings() {
  return new RegExp(""
    +"[.?!,&…]|" //common punctuation
    +"\\n|" //newline
    +"\\s(and|but|so|then|because|therefore)\\s|" //connecting words (with spaces so as not to match 'some' or 'husband')
    +"(\\s[-–—]\\s)|" //hyphen and dashes, but not hyphenated words
    +"(http)|" //a url
    +"@[a-zA-Z\\d_]+" //a twitter handle
  ,'i')
}

//use the parts of speec of the words to see if they would make sense
//when inserted into the form 'how X is going'
function getAcceptableGrammar(activity) {
  var posArray = activity.pos;
      wordsArray = activity.words;
  if (!posArray) {
    throw new Error("couldn't find the is [emotion] in the tweet.");
  };
  var acceptable3words = [
    ['vbg', '*', 'nn'], //gerund + noun (being a dog, making my bed)
    ['vbg', '*', 'nns'], //plural
    ['prp$', '*', 'nn'], //possessive + noun (my best friend, your winged eyeliner)
    ['prp$', '*', 'nns'], //plural
    ['dt', '*', 'nn'], //determiner + noun (the united states)
    ['dt', '*', 'nns'] //plural
  ];
  var acceptable2words = [
    ['*', 'prp$', 'nn'], //possessive + noun (my day, her hair)
    ['*', 'prp$', 'nns'], //plural
    ['*', 'dt', 'nn'], //determiner + noun (the night, this year)
    ['*', 'dt', 'nns'], //plural
    ['*', 'vbg', '*'], //gerund phrase (dancing tonight, making love)
    ['*', 'prp$', 'vbg'], //possessive + gerund (my driving)
    ['*', 'dt', 'vbg'] //determiner + gerund (the painting)
  ];
  var passes = [];
  for(var i = 0; i < acceptable3words.length; i++) {
    var testArray = acceptable3words[i];
    for(var j = 0; j < 3; j++) {
      var expected = testArray[j];
      if(expected == '*' || expected == posArray[j]) { passes[j] = true; }
      else { passes[j] = false; }
    }
    if ( passes[0] && passes[1] && passes[2] ) {
      return activity.words.join(" ");
    } else {
      passes[0] = false;
      passes[1] = false;
      passes[2] = false;
    }
  }
  passes[0] = false;
  passes[1] = false;
  passes[2] = false;
  //then check for 2 word phrases
  for(var i = 0; i < acceptable2words.length; i++) {
    var testArray = acceptable2words[i];
    for(var j = 0; j < 3; j++) {
      var expected = testArray[j];
      if(expected == '*' || expected == posArray[j]) { passes[j] = true; }
      else { passes[j] = false; }
    }
    if( passes[1] && passes[2] ) {
      return wordsArray[1] + " " + wordsArray[2];
    }
  }
  //no phrases passed.
  //last ditch effort:
  if(posArray[2] === "vbg") {
    return wordsArray[2];
  }
  return "";
}