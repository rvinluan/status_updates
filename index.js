var rita = require('rita');
var lexicon = rita.RiLexicon();
var Twit = require('twit');
var T = new Twit(require('./config.js'));

var finalTweet = "I just ";

function tweet(sts) {
  T.post('statuses/update', { status: sts }, function(err, data, response) {
    // console.log('THE TWEET:' + data.text);
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
      var op = getOperative(text, verb);
      // console.log("text::"+text);
      console.log("operative::"+op);

      //the 'in case you were wondering part'
      var icyww = searchInCase();
    }
  })
}

function searchInCase() {
  var emotions = [
    'fun', 'lame', 'awesome', 'shitty', 'great',
    'amazing', 'stupid', 'boring', 'eventful'
  ];
  var emotion = emotions[Math.floor(Math.random() * emotions.length)];
  T.get('search/tweets', { q: "%22is "+emotion+"%22 -RT", count: 10 }, function(err, data, response) {
    if (handleErrors(err, data)) {return;}
    console.log('\033[36m');
    for(var i = 0; i < data.statuses.length; i++) {
      console.log(data.statuses[i].text);
      var icyww = data.statuses[i].text;
      console.log('\033[35m' + getActivity(icyww, emotion) + '\033[36m');
    }
    console.log('\033[0m');
  });
}

function getOperative(str, verb) {
  //find only the part that follows 'I just [verbed]'
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

function getActivity(tweet, emotion) {
  var tokens = tweet.toLowerCase().split(" ");
  var isIndex = -1;
  var newPhraseArray = [];
  var posArray = [];
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
    return "my day"; //generic, because we couldn't find anything in this tweet
  }

  //let's look at the 3 words before the "is [emotion]"
  //some of these will be undefined, that's ok
  for(var i = 0; i < 3; i++) {
    var text = tokens[isIndex - (3 - i)];
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

  var threewordphrase = newPhraseArray.map(function (value) {
    return value._text;
  })

  return threewordphrase.join(" ");
}

function randomGerund() {
  var baseVerb = lexicon.randomWord("vb");
  var gerund = rita.RiTa.conjugate(baseVerb, {
    tense: rita.RiTa.PRESENT_PARTICIPLE
  });
  console.log("GERUND::"+gerund);
}

//outputs a regex that checks for what I consider to be pauses or endings in thought
function thoughtEndings() {
  return new RegExp(""
    +"[.?!,&…]|" //common punctuation
    +"\\n|" //newline
    +"(and |but |so |then )|" //connecting words (with spaces so as not to match 'some' or 'butter')
    +"(\\s[-–—]\\s)|" //hyphen and dashes, but not hyphenated words
    +"(http)|" //a url
    +"@[a-zA_Z\\d]+" //a twitter handle
  ,'i')
}

searchJust();

// var test = new rita.RiString("his year");
// console.log(test.pos());
