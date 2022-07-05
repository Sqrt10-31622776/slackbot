const とても暑い = {temperature: 5};
const 暑い = {temperature: 4};
const 暖かい = {temperature: 3};
const 涼しい = {temperature: 2};
const 寒い = {temperature: 1};
const とても寒い = {temperature: 0};
const 高湿 = {humidity: 1};
const くもり = {condition: 'cloud'};
const 快晴 = {condition: 'clear'};
const 晴れ = {condition: 'sunny'};
const 雨 = {condition: 'rain'};
const 霧雨 = {condition: 'drizzle'};
const 雷雨 = {condition: 'thunderstorm'};
const 晴雨 = {condition: 'changing'};
const にわか雨 = {condition: 'shower'};
const 雪 = {condition: 'snow'};
const みぞれ = {condition: 'sleet'};
const 天気雨 = {condition: 'sunshower'};
const 霧 = {condition: 'mist'};
const 霞 = {condition: 'haze'};
const 砂嵐 = {condition: 'dust'};
const 長雨 = {continuingCondition: 'rain'};
const 小雨 = {rain: 1};
const 大雨 = {rain: 3};
const 豪雨 = {rain: 4};
const 無風 = {wind: 0};
const 微風 = {wind: 1};
const 風 = {wind: 2};
const 強風 = {wind: 3};
const 暴風 = {wind: 4};
const 北風 = {winddeg: 0};
const 東風 = {winddeg: 90};
const 南風 = {winddeg: 180};
const 西風 = {winddeg: 270};
const 寒くなる = {temperatureChange: -1};
const 暖かくなる = {temperatureChange: 1};
const 一月 = {month: [1]};
const 二月 = {month: [2]};
const 三月 = {month: [3]};
const 四月 = {month: [4]};
const 五月 = {month: [5]};
const 六月 = {month: [6]};
const 七月 = {month: [7]};
const 八月 = {month: [8]};
const 九月 = {month: [9]};
const 十月 = {month: [10]};
const 十一月 = {month: [11]};
const 十二月 = {month: [12]};
const 春 = {month: [3, 4, 5]};
const 夏 = {month: [6, 7, 8]};
const 秋 = {month: [9, 10, 11]};
const 冬 = {month: [12, 1, 2]};
const 梅雨 = {month: [6, 7]};

module.exports = {
	日本晴れ: [快晴],
	好天: [快晴],
	高天: [快晴],
	上日和: [快晴],
	蒼空: [晴れ],
	蒼天: [晴れ],
	晴天: [晴れ],
	青天: [晴れ],
	晴明: [晴れ],
	碧空: [晴れ],
	碧天: [晴れ],
	碧虚: [晴れ],
	碧霄: [晴れ],
	碧落: [晴れ],
	好晴: [晴れ],
	晴朗: [晴れ, 無風],
	曇天: [くもり],
	棚曇: [くもり],
	雲霄: [くもり],
	雲翳: [くもり],
	曇り空: [くもり],
	雨模様: [くもり],
	雨: [雨],
	雨空: [雨],
	雨天: [雨],
	飛雨: [風, 雨],
	風雨: [風, 雨],
	微風: [晴れ, 微風],
	軟風: [晴れ, 微風],
	軽風: [晴れ, 微風],
	小風: [晴れ, 微風],
	強風: [晴れ, 強風],
	颶風: [晴れ, 強風],
	風巻: [晴れ, 強風],
	大風: [晴れ, 強風],
	暴風: [晴れ, 暴風],
	狂飆: [晴れ, 暴風],
	強風雨: [強風, 雨],
	横雨: [強風, 雨],
	暴風雨: [暴風, 雨],
	黒風白雨: [暴風, 雨],
	気違い日和: [晴雨],
	狐日和: [晴雨],
	照り降り雨: [晴雨],
	霧雨: [霧雨],
	糠雨: [霧雨],
	小糠雨: [霧雨],
	煙雨: [霧雨],
	小雨: [雨, 小雨],
	疎雨: [雨, 小雨],
	微雨: [雨, 小雨],
	細雨: [雨, 小雨],
	涙雨: [雨, 小雨],
	糸雨: [雨, 小雨],
	袖笠雨: [雨, 小雨],
	零雨: [雨, 小雨],
	大雨: [雨, 大雨],
	篠突く雨: [雨, 大雨],
	繁吹雨: [雨, 大雨],
	強雨: [雨, 大雨],
	黒雨: [雨, 大雨],
	豪雨: [雨, 豪雨],
	沛雨: [雨, 豪雨],
	鉄砲雨: [雨, 豪雨],
	盆雨: [雨, 豪雨],
	天気雨: [天気雨],
	天泣: [天気雨],
	狐の嫁入り: [天気雨],
	照り雨: [天気雨],
	日照雨: [天気雨],
	日向雨: [天気雨],
	俄雨: [にわか雨],
	驟雨: [にわか雨],
	村雨: [にわか雨],
	通雨: [にわか雨],
	繁雨: [にわか雨],
	叢雨: [にわか雨],
	屢雨: [にわか雨],
	肘笠雨: [にわか雨],
	速雨: [にわか雨],
	郡雨: [にわか雨],
	暴雨: [にわか雨, 豪雨],
	鬼雨: [にわか雨, 豪雨],
	長雨: [長雨],
	宿雨: [長雨],
	陰雨: [長雨],
	淫雨: [長雨],
	地雨: [長雨],
	霖雨: [長雨],
	連雨: [長雨],
	積雨: [長雨],
	陰霖: [長雨],
	霖: [長雨],
	霙: [みぞれ],
	雪時雨: [みぞれ],
	雪雑: [みぞれ],
	雪: [雪],
	天花: [雪],
	天華: [雪],
	小雪: [雪, 小雨],
	風花: [雪, 小雨, 微風],
	薄雪: [雪, 小雨],
	細雪: [雪, 小雨],
	大雪: [雪, 大雨],
	豪雪: [雪, 大雨],
	回雪: [雪, 風],
	風雪: [雪, 風],
	飛雪: [雪, 風],
	吹雪: [雪, 強風],
	雪吹雪: [雪, 強風],
	雪風巻: [雪, 強風],
	雪嵐: [雪, 暴風],
	暴風雪: [雪, 暴風],
	霧: [霧],
	雨霧: [霧],
	狭霧: [霧],
	霧時雨: [霧],
	霧襖: [霧],
	霞: [霞],
	曇り霞: [霞],
	砂嵐: [砂嵐],
	黒風: [砂嵐, 強風],

	炎暑: [とても暑い],
	酷暑: [とても暑い],
	厳暑: [とても暑い],
	極暑: [とても暑い],
	酷熱: [とても暑い],
	極熱: [とても暑い],
	甚暑: [とても暑い],
	大暑: [とても暑い],
	熱暑: [とても暑い],
	暑湿: [暑い, 高湿],
	蒸暑: [暑い, 高湿],
	溽暑: [暑い, 高湿],
	油照: [暑い, 高湿],
	炎天: [暑い, 晴れ],
	暑天: [暑い, 晴れ],
	寒天: [寒い, 晴れ],
	凍晴: [寒い, 晴れ],
	寒雨: [寒い, 雨],
	冷雨: [寒い, 雨],
	寒雲: [寒い, くもり],
	凍雲: [寒い, くもり],
	凍曇: [寒い, くもり],
	寒凪: [寒い, 無風],
	寒風: [寒い, 晴れ, 風],
	冷風: [寒い, 晴れ, 風],
	寒雷雨: [寒い, 雷雨],
	冷寒: [寒い],
	寒烈: [とても寒い],
	厳寒: [とても寒い],
	酷寒: [とても寒い],
	凍寒: [とても寒い],
	氷雨: [とても寒い, 雨],
	凍雨: [とても寒い, 雨],

	初凪: [{date: [[1, 1]]}, 無風],
	初晴: [{date: [[1, 1]]}, 晴れ],
	三白: [{date: [[1, 1], [1, 2], [1, 3]]}, 雪],
	御降: [{date: [[1, 1], [1, 2], [1, 3]]}, 雨],
	寒九の雨: [{date: [[1, 13]]}, 雨],
	寒の入: [一月, 寒くなる],
	寒の雨: [一月, 雨],
	臘雪: [一月, 雪],
	節東風: [一月, 晴れ, 東風],
	儺追風: [{date: [[2, 17]]}, 風],
	涅槃西: [二月, 晴れ, 西風],
	彼岸西風: [二月, 晴れ, 西風],
	涅槃雪: [二月, 雪],
	雪の果: [二月, 雪],
	雪の別れ: [二月, 雪],
	名残の雪: [二月, 雪],
	春寒: [二月, 寒くなる],
	余寒: [二月, 寒い],
	花信風: [春, 晴れ, 風],
	強東風: [春, 晴れ, 強風, 東風],
	春北風: [春, 晴れ, 北風],
	春風: [春, 晴れ, 風],
	光風: [春, 晴れ, 風],
	春嵐: [春, 晴れ, 強風],
	春疾風: [春, 晴れ, 強風],
	春陰: [春, くもり],
	春曇: [春, くもり],
	養花天: [春, くもり],
	春雨: [春, 小雨],
	軽雨: [春, 小雨],
	紅雨: [春, 雨],
	紅梅の雨: [春, 雨],
	春時雨: [春, 晴雨],
	春霞: [春, 霞],
	暖雨: [春, 暖かい, 雨],
	春雪: [春, 雪],
	春雷: [春, 雷雨],
	春塵: [春, 砂嵐],
	霾翳: [春, 砂嵐],
	菜種梅雨: [{month: [3, 4]}, 雨],
	春霖: [{month: [3, 4]}, 長雨],
	鰊曇: [{month: [3, 4]}, くもり],
	寒の戻り: [三月, 暖かくなる],
	雪解雨: [三月, 雨],
	貝寄風: [三月, 晴れ, 風],
	春一番: [三月, 晴れ, 南風],
	鬼北: [三月, 晴れ, 強風, 北風],
	初電: [三月, 雷雨],
	木の芽流し: [三月, 長雨],
	梅若の涙雨: [{month: [4, 15]}, 雨],
	花曇: [四月, くもり],
	鳥曇: [四月, くもり],
	発火雨: [四月, 雨],
	催花雨: [四月, 雨],
	花の雨: [四月, 雨],
	花嵐: [四月, 晴れ, 強風],
	木の芽風: [四月, 晴れ, 風],
	油風: [四月, 晴れ, 微風],
	桜まじ: [四月, 晴れ, 微風, 暖かい],
	春驟雨: [四月, にわか雨],
	花冷え: [四月, 寒くなる],
	陽春: [四月, 晴れ, 暖かい],
	春暖: [四月, 暖かい],
	五月晴: [五月, 快晴],
	筍流し: [五月, 晴れ, 南風],
	茅花流し: [五月, 晴れ, 南風],
	卯月曇: [五月, くもり],
	卯の花腐し: [五月, 雨],
	五月雨: [五月, 雨],
	走り梅雨: [五月, 雨],
	翆雨: [五月, 雨],
	麦嵐: [五月, 晴れ, 風],
	虎が雨: [{date: [[5, 28]]}, 雨],
	曾我の雨: [{date: [[5, 28]]}, 雨],
	夕立: [夏, にわか雨],
	白雨: [夏, にわか雨],
	涼雨: [夏, 涼しい, 雨],
	電雨: [夏, 雷雨],
	夏霞: [夏, 霞],
	夏空: [夏, 快晴],
	青嵐: [夏, 晴れ, 強風],
	梅雨: [梅雨, 雨],
	梅霖: [梅雨, 雨],
	梅雨空: [梅雨, くもり],
	梅雨曇: [梅雨, くもり],
	梅雨晴れ: [梅雨, 晴れ],
	ながしはえ: [梅雨, 晴れ, 南風],
	梅雨寒: [梅雨, 寒い],
	梅雨雷: [梅雨, 雷雨],
	黒南風: [六月, 晴れ, 風],
	薄暑: [六月, 晴れ, 暑い],
	麦雨: [六月, 雨],
	若葉雨: [六月, 雨],
	いなさ: [六月, 晴れ, {winddeg: 135}],
	黄雀風: [六月, 晴れ, {winddeg: 135}],
	白南風: [七月, 晴れ, 南風],
	緑雨: [七月, 雨],
	暴れ梅雨: [七月, 大雨],
	送り梅雨: [七月, 雷雨],
	残り梅雨: [七月, 小雨],
	薫風: [七月, 晴れ, 風],
	半夏雨: [{date: [[7, 2]]}, 雨],
	洗車雨: [{date: [[7, 6]]}, 雨],
	洒涙雨: [{date: [[7, 7]]}, 雨],
	裕次郎雨: [{date: [[7, 17]]}, 雨],
	土用雨: [八月, 雨],
	土用凪: [八月, 無風],
	土用東風: [八月, 晴れ, 東風],
	盆東風: [八月, 晴れ, 東風],
	土用あい: [八月, 晴れ, 北風],
	送りまぜ: [八月, 晴れ, 南風],
	夏陰: [八月, 涼しい],
	秋日和: [秋, 快晴, 涼しい],
	秋空: [秋, 晴れ],
	秋旻: [秋, 晴れ],
	秋晴れ: [秋, 晴れ],
	爽籟: [秋, 晴れ, 微風],
	秋風: [秋, 晴れ, 風],
	素風: [秋, 晴れ, 風],
	金風: [秋, 晴れ, 風],
	野分: [秋, 強風],
	秋陰: [秋, くもり],
	秋雨: [秋, 雨],
	秋湿り: [秋, 長雨],
	秋霖: [秋, 長雨],
	秋微雨: [秋, 長雨],
	秋入梅: [秋, 長雨],
	白驟雨: [秋, にわか雨],
	芋嵐: [秋, 晴れ, 強風],
	秋雪: [秋, 雪],
	秋時雨: [九月, 晴雨],
	やまじ: [九月, 晴れ, 強風],
	初嵐: [九月, 晴れ, 強風],
	菊日和: [九月, 快晴],
	爽秋: [九月, 晴れ, 風, 涼しい],
	秋涼: [九月, 晴れ, 風, 涼しい],
	液雨: [{month: [10, 11]}, 晴雨],
	時雨: [{month: [10, 11, 12]}, 晴雨],
	伊勢清めの雨: [{date: [[10, 16]]}, 雨],
	雁渡: [十月, 晴れ, 北風],
	秋冷: [十月, 寒い],
	文化の日の晴れ: [{date: [[11, 3]]}, 快晴],
	小春空: [十一月, 晴れ],
	神渡: [十一月, 晴れ, 西風],
	神立風: [十一月, 晴れ, 西風],
	星の入東風: [十一月, 晴れ, 東風],
	御講凪: [十一月, 晴れ, 無風],
	凩: [十一月, 風, 寒い],
	露寒: [十一月, 寒い],
	小春日和: [十一月, 暖かくなる],
	冬暖: [冬, 晴れ, 暖かい],
	村時雨: [冬, 晴雨],
	冬晴れ: [冬, 晴れ],
	冬日和: [冬, 快晴, 寒い],
	寒晴: [冬, 晴れ, とても寒い],
	ならい: [冬, 晴れ, 北風],
	空風: [冬, 晴れ, {winddeg: 315}],
	大西: [冬, 晴れ, 強風, 西風],
	冬霞: [冬, 霞],
	八日吹: [{date: [[12, 8]]}, 雪],
	鬼洗い: [{date: [[12, 31]]}, 雨],
	解霜雨: [十二月, 雨],
	鰤起し: [十二月, 雷雨],
};
