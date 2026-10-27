/* Approved hiragana copy. Groups select matching meow families, not spoken TTS. */
window.MochiMessages = (() => {
  const regular = [
    ['ふむ、きょうも いっしょにゃな','happy'],
    ['あわてず、のんびり いこうのう','relaxed'],
    ['もぐもぐ。わしも たべておるぞ','happy'],
    ['ひとくちずつで よいのにゃ','relaxed'],
    ['なんだか いい においにゃのう','happy'],
    ['ごはんの じかんは たのしいのう','happy'],
    ['よく かんで、あじわうのにゃ','relaxed'],
    ['おくちの なかで もぐもぐにゃ','happy'],
    ['どんな あじが するんにゃろ','affectionate'],
    ['おいしいものは ゆっくりにゃ','relaxed'],
    ['わしは ここで みておるぞ','relaxed'],
    ['ひとやすみも だいじにゃのう','relaxed'],
    ['ふむ、よい たべっぷりにゃ','happy'],
    ['おなかと そうだん するのにゃ','relaxed'],
    ['きょうの ごはんも ええのう','happy'],
    ['わしの おなかも まるくなるぞ','happy'],
    ['ほっぺが もちもちに なりそうにゃ','happy'],
    ['おや、わしの ほっぺを みたな','surprised'],
    ['この おなかには ひみつが あるぞ','surprised'],
    ['ふむ。おいしいと みみが うごくのう','happy'],
    ['わしの ぶんも……あるんにゃろ？','affectionate'],
    ['おやつの ゆめを みそうにゃ','relaxed'],
    ['わしは ごはんの においに くわしいぞ','happy'],
    ['ごはんの まえでは わしも ごきげんにゃ','happy'],
    ['いっしょに たべると うれしいのう','affectionate'],
    ['その ひとくちを じっくりにゃ','relaxed'],
    ['わしの もちもちも そだっておるぞ','happy']
  ];
  const named = [
    ['{なまえ}、きょうも いっしょにゃな','happy'],
    ['{なまえ}の となりは おちつくのう','affectionate'],
    ['{なまえ}、のんびり たべようのう','relaxed'],
    ['{なまえ}、わしも もぐもぐにゃ','happy'],
    ['{なまえ}、どんな あじが するんにゃ？','affectionate'],
    ['{なまえ}、わしの ほっぺを みたか？','surprised'],
    ['{なまえ}、ひとやすみも よいのにゃ','relaxed'],
    ['{なまえ}と ごはん。わしは ごきげんにゃ','happy'],
    ['{なまえ}、わしの おなかも まるいぞ','happy']
  ];
  const tap = [
    ['おっ、わしを よんだかにゃ？','surprised'],
    ['くすぐったいにゃ','happy'],
    ['ふむ、なでるのが じょうずにゃ','affectionate']
  ];
  function draw(list, bag = [], last = -1) {
    if (!Array.isArray(bag) || !bag.length || bag.some(i => !Number.isInteger(i) || i < 0 || i >= list.length)) {
      bag = list.map((_, i) => i);
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    }
    if (bag.at(-1) === last && bag.length > 1) [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
    const index = bag.pop();
    return { index, bag, text: list[index][0], group: list[index][1] };
  }
  function next(session, name) {
    const count = (Number.isSafeInteger(session.messageCount) && session.messageCount >= 0 ? session.messageCount : 0) + 1;
    const useName = count % 4 === 0;
    const key = useName ? 'named' : 'regular';
    const result = draw(useName ? named : regular, session[key + 'Bag'], session[key + 'Last']);
    session.messageCount = count;
    session[key + 'Bag'] = result.bag;
    session[key + 'Last'] = result.index;
    return { text: result.text.replace('{なまえ}', name), group: result.group, named: useName };
  }
  return { regular, named, tap, next };
})();
