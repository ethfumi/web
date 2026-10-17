// プリセット曲。メロディは「ドレミ」の文字で書く(書き方は app.js の parseMelody を参照)。
//   ド レ ミ ファ ソ ラ シ … 1拍
//   ー … 1拍のばす      (ドレ) … かっこの中で1拍を分ける
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
  //   うたう言葉は「ま」(へんしゅうで「あ」や、高さに合わせて読みかえる「ドレミ」にもできる)。
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
];
