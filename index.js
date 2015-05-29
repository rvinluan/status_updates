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
    if (handleErrors(err, data)) {return;}
    if (handleErrors(err, data) == 2) {
      searchJust();
      return;
    }
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
  T.get('search/tweets', { q: "%22is fun%22", count: 20 }, function(err, data, response) {
    if (handleErrors(err, data)) {return;}
    console.log('icyww::');
    for(var i = 0; i < data.statuses.length; i++) {
      console.log(data.statuses[i].text);
      var icyww = data.statuses[i].text;
    }
    console.log('icyww-end::');
    // var randomIndex = Math.floor(Math.random() * 20);
    if (icyww) {
      var activity = getActivity(icyww);
      console.log("activity::"+activity);
    } else {
      console.log("no tweets");
    }
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

function getActivity(tweet) {
  console.log("activitytweet::"+tweet);
  var tokens = tweet.toLowerCase().split(" ");
  var is = tokens.indexOf("is");
  console.log("isIndex::"+is);
  if(is >= tokens.length - 1 || is < 1) {
    return "my day";
  }
  if(tokens[is+1].indexOf("fun") !== -1) {
    return tokens[is - 2] +" "+ tokens[is - 1];
  }
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
    +"@[a-zA_Z\\d]+" //a username
  ,'i')
}

//searchJust();

var test = new rita.RiString("his year");
console.log(test.pos());
