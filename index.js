var rita = require('rita');
var lexicon = rita.RiLexicon();

var Twit = require('twit');
var T = new Twit(require('./config.js'));

var CronJob = require('cron').CronJob;
new CronJob('0 */5 * * * *', function() {
  //tweet once, once an hour
  searchPart1();
}, null, true, 'America/New_York');

function tweet(sts) {
  T.post('statuses/update', { status: sts }, function(err, data, response) {
    if(err) {
      console.log("There was an err:"+err);
    }
  })
}

function handleErrors(err, data, callback) {
  if(err) {
    console.log("There was an err:"+err);
    return 1;
  }
  if(!data || !data.statuses || data.statuses.length == 0) { 
    console.log("No tweets found for chosen verb.");
    if(callback) {
      callback();
    }
    return 2; 
  }
  return 0;
}

//some extra parameters for search:
//--no retweets
//--don't use your own tweets (duh)
function buildSearchQuery(str) {
  return str + " -RT -from:justdidathing";
}

//the 'I Just...' part
function searchPart1() {
  var tweetBody = "I just ";
  var verb = lexicon.randomWord("vbd");
  console.log("verb::"+verb);
  var query = buildSearchQuery("%22I just "+verb+"%22");
  T.get('search/tweets', { q: query, count: 1 }, function(err, data, response) {
    
    if( handleErrors(err, data, searchPart1) ) {
      return;
    }

    for(var i = 0; i < data.statuses.length; i++) {
      var text = data.statuses[i].text;
      var op = getOperative(text.toLowerCase(), verb.toLowerCase());
      console.log("text::"+text);
      // console.log("operative::"+op);

      //trim op for whitespace
      if(op.charAt(op.length - 1) == " ") {
        op = op.slice(0, -1);
      }
      tweetBody = removeTrailingExclamations(removeTrailingPrepostions(tweetBody + op));
      //do the 2nd part
      if(Math.random() > 0.3) {
        searchPart2_Verb(tweetBody);
      } else {
        searchPart2_Noun(tweetBody);
      }
    }
  })
}

function getRandomEmotion() {
  var emotions = [
    'fun', 'lame', 'awesome', 'shitty', 'great',
    'amazing', 'stupid', 'boring', 'eventful',
    'perfect', 'unbelievable', 'ridiculous',
    'intense', 'crazy', 'good', 'exciting', 'sad'
  ];
  return emotions[Math.floor(Math.random() * emotions.length)];
}

//searches for tweets of the form 'x is fun'
//will also use other emotions like awesome or lame in place of fun
function searchPart2_Noun(tweetBody) {
  var emotion = getRandomEmotion();
  var query = buildSearchQuery("%22is "+emotion+"%22");
  var rest = "";

  console.log("searching for a noun that::'"+emotion+"'");
  T.get('search/tweets', { q: query, count: 10, lang: "en" }, function(err, data, response) {
    if (handleErrors(err, data)) { return; }
    console.log('\033[91m');  
    for(var i = 0; i < data.statuses.length; i++) {
      var tweetText = data.statuses[i].text;
      var np = getNounPhrase(tweetText, emotion);
      console.log(tweetText);
      if(np) {
        console.log("\033[32mgood noun phrase::"+np+"\033[91m");
        rest = np;
      } else {
        console.log("\033[33munnacepted noun phrase\033[91m");
      }
    }
    console.log('\033[0m');

    putItTogether(tweetBody, replaceOddPronouns(rest), []);
  });
}

//searches for tweets for random gerunds
function searchPart2_Verb(tweetBody) {
  var verb = lexicon.randomWord("vbg");
  console.log("searching with a random gerund::"+verb);
  var query = buildSearchQuery(verb);
  T.get('search/tweets', { q: query, count: 10, lang: "en" }, function(err, data, response) {
    if (handleErrors(err, data)) {return;}
    console.log('\033[91m');  
    var bestScore = "";
    var finalag = verb;
    for(var i = 0; i < data.statuses.length; i++) {
      var tweetText = data.statuses[i].text;
      console.log(tweetText);
      //let's immediately eliminate statuses with links,
      //because these tend to contain either spam or headlines 
      //(both of which are not the best examples of grammar)
      if(tweetText.indexOf("http") !== -1) {
        console.log("\033[34mlink detected. Skipping.\033[91m")
        continue;
      }
      var ag = getActivity(tweetText, verb);
      if (ag) {
        if(verbPhraseScore(ag) >= verbPhraseScore(bestScore)) {
          finalag = ag;
          bestScore = ag;
        }
        console.log('\033[32m' + ag + '\033[91m');          
      } else {
        console.log('\033[33m' + "words not found" + '\033[91m');
        continue;
      }
    }
    console.log('\033[0m');
    putItTogether(tweetBody, replaceOddPronouns(finalag), 
      [" while {#x}",
      ". That's what I get for {#x}",
      ", all because I was {#x}",
      ". Also I'm {#x}"]
    ); 
  });
}

function putItTogether(tweetBody, rest, extraPhrases) {
  var phrasings = [
    ", in case you were wondering how {#x} is going",
    ". All because of {#x}",
    ", so {#x} is going to be {#y}",
    ", which is {#y} for {#x}"
  ].concat(extraPhrases);
  var phrasing = phrasings[Math.floor(Math.random() * phrasings.length)];

  if(rest) {
    phrasing = phrasing.replace("{#x}", rest).replace("{#y}", getRandomEmotion());
    tweetBody += phrasing;
  }
  console.log("FINAL TWEET ============================("+tweetBody.length+")!");
  console.log(tweetBody);
  tweet(tweetBody);

}

//find the part of a tweet that follows 'I just [verbed]' or '[verbing]'
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

//find the words after a gerund and see if they work.
function getActivity(tweet, verb) {
  var operative = getOperative(tweet.toLowerCase(), verb);
  var tokens = sanitize(operative.split(" "));
  var endIndex = 0;
  var testWord;

  console.log("stripped-operative::"+tokens.join(" "));

  //working backwards, find the noun and chop there.
  for (var j = tokens.length; j >= 0; j--) {
    if(isANoun(tokens[j])) {
      endIndex = j;
      break;
    }
  }

  return tokens.slice(0, endIndex + 1).join(" ");
}

function getNounPhrase(tweet, emotion) {
  var tokens = sanitize(tweet.split(" "));
  var startIndex = -1;

  //find the emotion
  for(var i = 0; i < tokens.length; i++) {
    if(tokens[i] === emotion) {
      //set the phrase to start 3 words behind the 'is [emotion]'
      if(i < 4) {
        i = 0;
      } else {
        startIndex = i - 4;
      }
      break;
    }
  }

  if(startIndex < 0) {
    return "";
  }
  
  var threeWordPhrase = tokens.slice(startIndex, startIndex+3);
  console.log("raw phrase::"+threeWordPhrase.join(" "));
  return getAcceptableGrammar(threeWordPhrase);
}

function replaceOddPronouns(str) {
  var newstr = str.replace(/(\s|^)(your|his|her|their)\s/i, " my ");
  return newstr.charAt(0) === " " ? newstr.substring(1) : newstr ;
}

function sanitize(tokensArray) {
  //removes punctuation
  for (var i = 0; i < tokensArray.length; i++) {
    tokensArray[i] = rita.RiTa.stripPunctuation(tokensArray[i].toLowerCase());
  };

  return tokensArray;
}

//helper function, because lexicon.isNoun() has false positives
function isANoun(word) {
  if(!word) {
    return false;
  }
  var ristring = new rita.RiString(word);
  //one exception: the word 'I'
  if(word.toLowerCase() === 'i') {
    return false;
  }
  return lexicon.isNoun(word) && ristring.pos().indexOf("nn") !== -1;
}

//pick better verb phrases.
//right now it just optimizes for phrases that are 3 or 4 words.
function verbPhraseScore(phrase) {
  var tokens = phrase.split(" ");
  if(tokens.length == 3 || tokens.length == 4) {
    return 100;
  } else if(tokens.length > 4) {
    return 75;
  } else if(tokens.length == 2) {
    return 50;
  } else {
    return 0;
  }
}

//you're not supposed to end a sentence with a preposition, right?
//this also removes possessive pronouns, because they should be followed by something.
function removeTrailingPrepostions(str) {
  var prepsToRemove = 0;
  var tokens = str.split(" ");
  var pos;
  for(var i = tokens.length - 1; i >= 0; i--) {
    pos = new rita.RiString(tokens[i]).pos();
    if( pos[0] === "in" || pos[0] === "to" || pos[0] === "prp$") {
      prepsToRemove++;
    } else {
      break;
    }
  }

  return tokens.slice(0, tokens.length - prepsToRemove).join(" ");
}

//a lot of times people will add some qualifier,
//we want to get rid of those because Rita thinks they're nouns
function removeTrailingExclamations(str) {
  var exclamations = [
    "lmfao",
    "lmao",
    "lol",
    "omg",
    "omfg",
    "wow",
    "jfc",
    "oops",
    "smh",
    "smdh"
  ];
  var exsToRemove = 0;
  var tokens = str.split(" ");
  var pos;
  for(var i = tokens.length - 1; i >= 0; i--) {
    if(exclamations.indexOf(tokens[i]) !== -1) {
      exsToRemove++;
    } else {
      break;
    }
  }

  return tokens.slice(0, tokens.length - exsToRemove).join(" ");
}

//outputs a regex that checks for things that can be considered to be pauses or endings in thought
function thoughtEndings() {
  var endings = [
    "[.?!,;&…/\"]" //common punctuation
    ,"[=:<]" //punctuation that is likely to start emoticons
    ,"\\n" //newline
    ,"\\s(and|but|or|so|then|because|therefore|n)\\s" //connecting words (with spaces so as not to match 'some' or 'husband')
    ,"(\\s[-–—]\\s)" //hyphen and dashes, but not hyphenated words
    ,"(http)" //a url
    ,"@[a-zA-Z\\d_]+" //a twitter handle
    ,"(i|i'm|i'll)\\s" //first person words, which usually signal a run on sentence
  ];

  return new RegExp(endings.join("|"),"i");
}

//use the parts of speec of the words to see if they would make sense
//when inserted into the form 'how X is going'
function getAcceptableGrammar(threeWordPhrase) {
  var posArray = threeWordPhrase.map(function (elem) {
    return new rita.RiString(elem).pos(); 
  })
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
      return threeWordPhrase.join(" ");
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
      return threeWordPhrase.slice(1,3).join(" ");
    }
  }
  //no phrases passed.
  return "";
}
