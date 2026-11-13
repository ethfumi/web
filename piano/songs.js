// プリセット曲。メロディは「ドレミ」の文字で書く(書き方は app.js の parseMelody を参照)。
//   ド レ ミ ファ ソ ラ シ … 1拍
//   ー … 1拍のばす      (ドレ) … かっこの中で1拍を分ける
//   かっこの中の ー はその音を長めに、かっこのうしろの ー はかっこ全体を長くする
//     (ソーーラ) … 1拍を ソ3:ラ1    (ミーーレ)ー … 2拍を ミ1.5拍・レ0.5拍(付点)
//   ↑ / ↓ … 1オクターブ上 / 下   # … 半音上   ウ … 1拍やすみ
//   / か 改行 … 譜面の行がえ
// chords は左手の伴奏。C F G G7 Am Dm Em など、1つ＝2拍(「C:4」で4拍)。
//   書かなければメロディから自動でつける。
// 歌詞は著作権があるため同梱せず、画面の「へんしゅう」からおうちで入力して端末に保存する。
window.PIANO_SONGS = [
  {
    id: 'kirakira',
    title: 'きらきら星',
    bpm: 92,
    melody: `
      ドドソソ ララソー
      ファファミミ レレドー
      ソソファファ ミミレー
      ソソファファ ミミレー
      ドドソソ ララソー
      ファファミミ レレドー`,
    chords: `
      C:4 F C
      F C G7 C
      C F C G
      C F C G
      C:4 F C
      F C G7 C`,
  },
  {
    id: 'tulip',
    title: 'チューリップ',
    bpm: 100,
    melody: `
      ドレミー ドレミー
      ソミレド レミレー
      ドレミー ドレミー
      ソミレド レミドー
      ソソミソ ララソー
      ミミレレ ドーーウ`,
    chords: `
      C:4 C:4
      C:4 G:4
      C:4 C:4
      C:4 G7 C
      C:4 F C
      C G7 C:4`,
  },
  {
    id: 'kaeru',
    title: 'かえるのうた',
    bpm: 100,
    melody: `
      ドレミファ ミレドー
      ミファソラ ソファミー
      ドウドウ ドウドウ
      (ドド)(レレ)(ミミ)(ファファ) ミレドー`,
    chords: `
      C:4 G7 C
      C F C:4
      C:4 C:4
      C Dm G7 C`,
  },
  {
    id: 'mary',
    title: 'メリーさんのひつじ',
    bpm: 104,
    melody: `
      ミレドレ ミミミー
      レレレー ミソソー
      ミレドレ ミミミミ
      レレミレ ドーーー`,
    chords: `
      C:4 C:4
      G:4 C:4
      C:4 C:4
      G7:4 C:4`,
  },
  {
    id: 'choucho',
    title: 'ちょうちょう',
    bpm: 100,
    melody: `
      ソミミー ファレレー
      ドレミファ ソソソー
      ソミミー ファレレー
      ドミソソ ミミミー
      レレレレ レミファー
      ミミミミ ミファソー
      ソミミー ファレレー
      ドミソソ ドーーー`,
    chords: `
      C:4 G7:4
      C:4 C:4
      C:4 G7:4
      C:4 C:4
      G7:4 G7:4
      C:4 C:4
      C:4 G7:4
      C G7 C:4`,
  },
  {
    id: 'london',
    title: 'ロンドン橋',
    bpm: 100,
    melody: `
      (ソーーラ)ーソファ ミファソー
      レミファー ミファソー
      (ソーーラ)ーソファ ミファソー
      レーソー ミドーー`,
    chords: `
      C:4 C:4
      G:4 C:4
      C:4 C:4
      G:4 C:4`,
  },
  {
    id: 'joy',
    title: 'よろこびの歌',
    bpm: 96,
    melody: `
      ミミファソ ソファミレ
      ドドレミ (ミーーレ)ーレー
      ミミファソ ソファミレ
      ドドレミ (レーード)ードー
      レレミド レ(ミファ)ミド
      レ(ミファ)ミレ ドレソ↓ー
      ミミファソ ソファミレ
      ドドレミ (レーード)ードー`,
    chords: `
      C:4 G:4
      C:4 G:4
      C:4 G:4
      C:4 G7 C
      G:2 C:2 G:2 C:2
      G:2 C:2 Am D7
      C:4 G:4
      C:4 G7 C`,
  },
  {
    id: 'custom',
    title: 'じぶんの曲',
    bpm: 100,
    custom: true,
    melody: `
      ドレミー ミレドー
      ドレミレ ドレドー`,
  },

  // ---- はっせい(発声練習) ----
  // exercise: pattern を1回ずつ半音あげて from→to までのぼり、またおりてくる。
  //   from / to は pattern の「ド」をどの高さにするか(ド=60, レ=62 …)。
  //   words: きまった言葉(1音ずつ、スペースで区切る)。よみの「ことば」でこれをうたう。
  //   dir: 'up' なら のぼるだけで おりてこない。
  //   うたう言葉は「ドレミ」を、その回の高さに合わせて読みかえる(移動ド)。へんしゅうで「ま」「あ」にもできる。
  //   毎回、歌いだす前に次の高さの和音を2分音符でならす。さいごの音も2分音符にして、
  //   「ドレミレ ド(2分) 和音(2分)」とすきまなく続ける。
  {
    id: 'ex-long', title: 'ロングトーン', bpm: 84,
    exercise: { pattern: 'ドーーー', chords: 'C:4', from: 60, to: 69 },
  },
  {
    id: 'ex-3', title: 'ドレミレド', bpm: 96,
    exercise: { pattern: 'ドレミレ ドー', chords: 'C:2 G7:2 C:2', from: 60, to: 65 },
  },
  {
    id: 'ex-5', title: 'ドレミファソ', bpm: 100,
    exercise: { pattern: 'ドレミファ ソファミレ ドー', chords: 'C:4 G7:4 C:2', from: 60, to: 62 },
  },
  {
    id: 'ex-arp', title: 'ドミソミド', bpm: 92,
    exercise: { pattern: 'ドミソミ ドー', chords: 'C:6', from: 60, to: 64 },
  },
  {
    id: 'ex-down', title: 'ソファミレド', bpm: 96,
    exercise: { pattern: 'ソファミレ ドー', chords: 'G7:4 C:2', from: 60, to: 65 },
  },
  {
    id: 'ex-mrd', title: 'ミレド', bpm: 92,
    exercise: { pattern: 'ミレ ドー', chords: 'C:1 G7:1 C:2', from: 60, to: 67 },
  },
  {
    id: 'ex-stacc', title: 'スタッカート', bpm: 88,
    exercise: { pattern: '(ドウ)(ミウ)(ソウ)(ミウ) ドー', chords: 'C:6', from: 60, to: 64 },
  },
  {
    id: 'ex-oct', title: 'ドミソドソミド', bpm: 92,
    exercise: { pattern: 'ドミソド↑ ソミドー', chords: 'C:8', from: 60, to: 62 },
  },
  {
    id: 'ex-scale', title: 'ドレミファソラシド', bpm: 108,
    exercise: { pattern: 'ドレミファ ソラシド↑ シラソファ ミレドー', chords: 'C:6 G7:8 C:2', from: 60, to: 62 },
  },
  {
    id: 'ex-ha', title: 'はっはっはー', bpm: 96,
    exercise: { pattern: '(ドウ)(ドウ) ドー', chords: 'C:4', from: 60, to: 69, words: 'はっ はっ はー' },
  },
  {
    id: 'ex-mame', title: 'まめまめ', bpm: 100,
    exercise: { pattern: 'ドレミファ ソファミレ ドー', chords: 'C:4 G7:4 C:2', from: 60, to: 65, words: 'ま め ま め ま め ま め まー' },
  },
  {
    id: 'ex-kira', title: 'きらきら星(転調)', bpm: 100,
    exercise: { pattern: 'ドドソソ ララソー ファファミミ レレドー', chords: 'C:4 F C F C G7 C', from: 60, to: 65 },
  },
  {
    id: 'ex-rise', title: 'のぼっていく', bpm: 100,
    exercise: { pattern: 'ドレミファ ソー', chords: 'C:4 G:2', from: 60, to: 67, syl: 'あ', dir: 'up' },
  },
];
