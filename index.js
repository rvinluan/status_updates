var rita = require('rita');
var lexicon = rita.RiLexicon();

var Twit = require('twit');
var T = new Twit(require('./config.js'));

var CronJob = require('cron').CronJob;
new CronJob('0 */20 * * * *', function() {
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
      if(Math.random() > 0.5) {
        searchPart2_Noun(tweetBody);
      } else {
        searchPart2_Verb(tweetBody);
      }
    }
  })
}

function getRandomEmotion() {
  var emotions = [
    'fun', 'lame', 'awesome', 'shitty', 'great',
    'amazing', 'stupid', 'boring', 'rad',
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

  console.log("searching for a noun that is::'"+emotion+"'");
  T.get('search/tweets', { q: query, count: 10, lang: "en" }, function(err, data, response) {
    
    if (handleErrors(err, data)) { return; }
    
    var longest = "";
    var finalChoice = "";
    console.log('\033[91m');  
    for(var i = 0; i < data.statuses.length; i++) {
      var tweetText = data.statuses[i].text;
      console.log(tweetText);
      var np = getNounPhrase(tweetText, emotion);
      if(np) {
        console.log("\033[32mgood noun phrase::"+np+"\033[91m");
        if(np.length > longest.length) {
          finalChoice = np;
          longest = np;
        } else {

        }
      } else {
        console.log("\033[33munnacepted noun phrase\033[91m");
      }
    }
    console.log('\033[0m');

    putItTogether(tweetBody, replaceOddPronouns(finalChoice), []);
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
    var longest = "";
    var finalChoice = verb;
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
      var vp = getVerbPhrase(tweetText, verb);
      if (vp) {
        if(vp.length > longest.length) {
          finalChoice = vp;
          longest = vp;
        }
        console.log('\033[32m' + vp + '\033[91m');          
      } else {
        console.log('\033[33m' + "words not found" + '\033[91m');
        continue;
      }
    }
    console.log('\033[0m');
    putItTogether(tweetBody, replaceOddPronouns(finalChoice), 
      [" while {#x}",
      " while {#x}",
      " while {#x}",
      " while {#x}",
      ". That's what I get for {#x}",
      ", all because I was {#x}",
      ". Also I'm {#x}",
      ". Also I'm {#x}",
      ". Also I'm {#x}",
      ". Also I'm {#x}"]
    ); 
  });
}

function putItTogether(tweetBody, rest, extraPhrases) {
  var phrasings = [
    ", in case you were wondering how {#x} is going",
    ", in case you were wondering how {#x} is going",
    ", in case you were wondering how {#x} is going",
    ", in case you were wondering how {#x} is going",
    ", in case you were wondering how {#x} is going",
    ", in case you were wondering how {#x} is going", //add weight
    " because of {#x}",
    " because of {#x}",
    " because of {#x}",
    " because of {#x}",
    " because of {#x}",
    ", so {#x} is going to be {#y}",
    ". {#x} is {#y}"
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
    if(matches[0] === "\"" 
      || matches[0] === ")" 
      || matches[0] === "]" 
      || matches[0] === "}") {
      return restOfString.substring(0, matches.index + 1);
    } else {
      return restOfString.substring(0,matches.index);
    }
  }
  else
    return restOfString;
}

//find the words after a gerund and match against acceptable phrases.
function getVerbPhrase(tweet, verb) {
  var operative = getOperative(tweet.toLowerCase(), verb);
  var tokens = sanitize(operative.split(" "));

  console.log("raw-phrase::"+tokens.join(" "));

  if(tokens.length > 4) {
    return getAcceptableGrammar(tokens.slice(0, 4));
  } else {
    return getAcceptableGrammar(tokens);
  }
}

//find the (up to) 4 words before 'is [emotion]' and return them if they match acceptable grammar.
//returns a string, empty if the grammar didn't match.
function getNounPhrase(tweet, emotion) {
  var emotionIndex = tweet.toLowerCase().indexOf(("is "+emotion)) - 1;
  if(emotionIndex < 0)
    return "";
  
  var relevantSubstring = tweet.substring(0, emotionIndex);
  var tokens = relevantSubstring.split(" ");
  var startIndex = 0;

  //working backwards...
  for(var i = tokens.length - 1; i >= 0; i--) {
    //stop at punctuation
    if( tokens[i].search(/[!.,;:–—@]/i) !== -1 ) {
      startIndex = i+1;
      break;
    }
    //or if we have 4 words already
    else if(i <= tokens.length - 4) {
      startIndex = i;
      break;
    }
  }
  
  var rawVerbPhrase = sanitize(tokens.slice(startIndex));
  console.log("raw phrase::"+rawVerbPhrase.join(" "));
  return getAcceptableGrammar(rawVerbPhrase);
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
    if( pos[0] === "in" || pos[0] === "to" || pos[0] === "prp$" || pos[0] === "dt") {
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
    "[.?!,;&…/]" //common punctuation
    ,"[\"\)\}\]]" //brackets quotes and parens
    ,"[=:<]" //punctuation that is likely to start emoticons
    ,"\\n" //newline
    ,"\\s{2,}" //multiple spaces in a row
    ,"\\s(and|n|but|or|so|then|because|bc|therefore)\\s" //connecting words (with spaces so as not to match 'some' or 'husband')
    ,"(\\s[-–—]\\s)" //hyphen and dashes, but not hyphenated words
    ,"(http)" //a url
    ,"@[a-zA-Z\\d_]+" //a twitter handle
    ,"(i|i'm|i'll)\\s" //first person words, which usually signal a run on sentence
  ];

  return new RegExp(endings.join("|"),"i");
}

//list of acceptable phrases
function getAcceptablePOSSequences(numWords) {
  var sequences = {
    0: [], //this shouldn't happen
    1: [
      ['nn'],
      ['nns'],
      ['vbg']
    ],
    2: [
      ['prp$', 'nn'], //my day
      ['prp$', 'nns'], //our cars
      ['dt', 'nn'], //the night
      ['dt', 'nns'], //the things
      ['vbg', 'nn'], //making love
      ['vbg', 'nns'], //taking pictures
      ['prp$', 'vbg'], //my driving
      ['dt', 'vbg'] //the painting
    ],
    3: [
      ['vbg', 'dt', 'nn'], //being a dog
      ['vbg', 'jj', 'nns'], //eating tasty pancakes
      ['vbg', 'nn', 'nns'], //wearing leather boots
      ['vbg', 'prp$', 'nn'], //making my bed
      ['vbg', 'prp$', 'nns'], //cleaning his shirts
      ['vbg', 'in', 'nns'], //cleaning under cars
      ['vbg', 'in', 'prp'], //teaming with him
      ['prp$', 'jjs', 'nn'], //my best friend
      ['prp$', 'jj', 'nn'], //your black eyeliner
      ['prp$', 'jjs', 'nns'], //plural
      ['prp$', 'jj', 'nns'],
      ['prp$', 'nn', 'nns'],
      ['dt', 'jj', 'nn'], //the united states
      ['dt', 'jjs', 'nns'],
      ['dt', 'nn', 'nns']
    ],
    4: [
      ['vbg', 'dt', 'jj', 'nn'], //being an insensitive prick
      ['vbg', 'dt', 'jj', 'nns'], //lifting the heavy weights
      ['vbg', 'dt', 'jjs', 'nn'], //baking the best cake
      ['vbg', 'dt', 'jjs', 'nns'], //playing the most instruments
      ['vbg', 'prp$', 'jj', 'nn'], 
      ['vbg', 'prp$', 'jj', 'nns'], //tying my colorful ties 
      ['vbg', 'prp$', 'jjs', 'nn'], 
      ['vbg', 'prp$', 'jjs', 'nns'],
      ['prp$', '*', '*', 'nn'], //my big deep moat
      ['prp$', '*', '*', 'nns'], //our usage of thimbles
      ['dt', '*', '*', 'nn'],
      ['dt', '*', '*', 'nns']
    ]
  }

  return sequences[numWords];
}

//use the parts of speech of the words to see if they would make sense
//when inserted into the form 'how X is going'
function getAcceptableGrammar(rawPhrase) {
  var posArray = rawPhrase.map(function (elem) {
    return new rita.RiString(elem).pos()[0]; 
  })
  var passes = false;
  var testAgainst = getAcceptablePOSSequences(posArray.length);
  outer: for(var i = 0; i < testAgainst.length; i++) {
    for( var j = 0; j < posArray.length; j++) {
      if (testAgainst[i][j] === '*' | posArray[j] === testAgainst[i][j]) {
        if( j === posArray.length - 1 ) {
          passes = true;
          break outer;
        }
      } else {
        break;
      }
    }
  }
  if (passes) {
    return rawPhrase.join(" ");
  } else {
    return "";
  }
}
