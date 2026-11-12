using System;
using System.IO;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Tellus
{
    public sealed class TellusPrototype : MonoBehaviour
    {
        [Serializable]
        private sealed class Replay
        {
            public int seed;
            public int westFood;
            public int eastFood;
            public int tick;
            public Order[] orders;
        }

        private World world;
        private int selected;
        private int initialWest = 16;
        private int initialEast = 42;
        private float accumulator;
        private int speed = 1;
        private bool running;
        private string seedText = "1206";
        private string spellText = "생장 (증폭)";
        private string feedback = "시작을 눌러 세계를 관찰하세요. 인물과 지역을 클릭하면 이동 명령을 예약합니다.";
        private Vector2 historyScroll;
        private GUIStyle titleStyle, headingStyle, bodyStyle, mutedStyle, tinyStyle, buttonStyle;
        private Texture2D white;
        private Font font;
        private readonly Color background = new Color(.045f, .065f, .075f);
        private readonly Color panel = new Color(.075f, .102f, .113f);
        private readonly Color line = new Color(.17f, .22f, .23f);
        private readonly Color amber = new Color(.92f, .73f, .41f);
        private readonly Color teal = new Color(.40f, .77f, .70f);
        private readonly Vector2[] points = {
            new Vector2(90, 220), new Vector2(210, 130), new Vector2(320, 225),
            new Vector2(430, 145), new Vector2(540, 235), new Vector2(650, 130)
        };

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void StartPrototype()
        {
            if (SceneManager.GetActiveScene().name != "TellusPrototype") return;
            if (FindFirstObjectByType<TellusPrototype>() == null)
                new GameObject("Tellus Prototype").AddComponent<TellusPrototype>();
        }

        private void Awake()
        {
            world = new World(1206, initialWest, initialEast);
            Application.runInBackground = true;
        }

        private void Update()
        {
            if (!running) return;
            accumulator += Time.unscaledDeltaTime * speed;
            int steps = 0;
            while (accumulator >= 1f && steps < 100)
            {
                world.Step();
                accumulator -= 1f;
                steps++;
            }
        }

        private void Styles()
        {
            if (white != null) return;
            white = Texture2D.whiteTexture;
            font = Font.CreateDynamicFontFromOSFont(new[] { "Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans CJK KR", "Arial" }, 16);
            bodyStyle = new GUIStyle(GUI.skin.label) { font = font, fontSize = 15, wordWrap = true };
            bodyStyle.normal.textColor = new Color(.87f, .91f, .9f);
            titleStyle = new GUIStyle(bodyStyle) { fontSize = 27, fontStyle = FontStyle.Bold };
            headingStyle = new GUIStyle(bodyStyle) { fontSize = 18, fontStyle = FontStyle.Bold };
            mutedStyle = new GUIStyle(bodyStyle) { fontSize = 13 };
            mutedStyle.normal.textColor = new Color(.56f, .66f, .67f);
            tinyStyle = new GUIStyle(mutedStyle) { fontSize = 11 };
            buttonStyle = new GUIStyle(GUI.skin.button) { font = font, fontSize = 14, padding = new RectOffset(8, 8, 5, 5) };
            GUI.skin.textField.font = font;
            GUI.skin.textField.fontSize = 15;
        }

        private void OnGUI()
        {
            Styles();
            GUI.matrix = Matrix4x4.Scale(new Vector3(Screen.width / 1440f, Screen.height / 900f, 1f));
            Box(new Rect(0, 0, 1440, 900), background);
            Header();
            Nations();
            Map();
            Inspector();
            History();
            Text(new Rect(24, 861, 1380, 30), feedback, mutedStyle);
        }

        private void Header()
        {
            Text(new Rect(24, 20, 180, 38), "T E L L U S", titleStyle);
            Text(new Rect(230, 28, 310, 25), "자율 세계 · 첫 플레이 프로토타입", mutedStyle);
            Text(new Rect(560, 24, 140, 32), "세계력 " + world.Tick + "일", headingStyle);
            if (Button(new Rect(715, 20, 110, 38), running ? "일시정지" : "시작", running ? teal : amber))
            {
                running = !running;
                accumulator = 0;
            }
            if (Button(new Rect(835, 20, 90, 38), "하루 진행"))
            {
                running = false;
                accumulator = 0;
                world.Step();
            }
            int[] speeds = { 1, 5, 20 };
            for (int i = 0; i < speeds.Length; i++)
                if (Button(new Rect(945 + i * 65, 20, 58, 38), speeds[i] + "×", speed == speeds[i] ? teal : line))
                    speed = speeds[i];
            if (Button(new Rect(1160, 20, 110, 38), "기록 저장")) Save();
            if (Button(new Rect(1280, 20, 130, 38), "기록 불러오기")) Load();
            Box(new Rect(24, 75, 1386, 1), line);
        }

        private void Nations()
        {
            Text(new Rect(24, 95, 250, 30), "세계의 현재", headingStyle);
            for (int i = 0; i < 2; i++)
            {
                var nation = world.Nations[i];
                float y = 138 + i * 212;
                Box(new Rect(24, y, 240, 197), panel);
                Box(new Rect(24, y, 3, 197), i == 0 ? amber : teal);
                Text(new Rect(40, y + 12, 212, 28), nation.Name, headingStyle);
                Text(new Rect(40, y + 45, 212, 35), nation.Government, mutedStyle);
                Text(new Rect(40, y + 85, 200, 25), "식량 " + nation.Food + "   국고 " + nation.Treasury, bodyStyle);
                Text(new Rect(40, y + 116, 200, 25), "생활 안정도 " + nation.Welfare + "%", bodyStyle);
                Box(new Rect(40, y + 148, 206, 4), line);
                Box(new Rect(40, y + 148, 206 * nation.Welfare / 100f, 4), i == 0 ? amber : teal);
                Text(new Rect(40, y + 163, 205, 24), nation.ExportBan ? "식량 수출 금지 중" : "식량 교역 허용", mutedStyle);
            }
            Text(new Rect(28, 580, 230, 30), "양국 관계  +" + world.Relations, headingStyle);
            Text(new Rect(28, 615, 235, 50), "성사된 교역 " + world.TradeCount + "회\n각국은 매일 식량 3을 소비합니다.", mutedStyle);
            Text(new Rect(24, 690, 230, 28), "초기 세계", headingStyle);
            Text(new Rect(24, 728, 55, 24), "시드", mutedStyle);
            seedText = GUI.TextField(new Rect(85, 724, 175, 30), seedText, 10);
            Text(new Rect(24, 766, 235, 25), "아르덴 초기 식량  " + initialWest, mutedStyle);
            initialWest = Mathf.RoundToInt(GUI.HorizontalSlider(new Rect(24, 799, 235, 18), initialWest, 5, 60));
            if (Button(new Rect(24, 822, 236, 30), "초기 설정으로 새 세계")) ResetWorld();
        }

        private void Map()
        {
            Box(new Rect(282, 96, 744, 455), panel);
            Text(new Rect(305, 111, 400, 27), "접경지대", headingStyle);
            Text(new Rect(305, 146, 680, 35), "인물을 선택한 뒤 지역을 누르면 이동 명령이 예약됩니다.", mutedStyle);
            GUI.BeginGroup(new Rect(282, 175, 744, 340));
            for (int row = 0; row < 9; row++)
                for (int col = 0; col < 20; col++)
                {
                    float tone = ((col * 7 + row * 13 + world.Seed % 100) % 9) * .003f;
                    Box(new Rect(col * 38, row * 38, 36, 36), new Color(.078f + tone, .111f + tone, .117f + tone));
                }
            for (int i = 0; i < points.Length - 1; i++) DrawLine(points[i], points[i + 1], 3, line);
            for (int i = 0; i < points.Length; i++)
            {
                var region = world.Regions[i];
                Vector2 point = points[i];
                Color tint = region.Nation == 0 ? amber : teal;
                Box(new Rect(point.x - 8, point.y - 8, 16, 16), tint);
                if (Button(new Rect(point.x - 52, point.y - 54, 104, 32), region.Name, tint))
                    Command(OrderType.Travel, i);
                string[] terrain = { "거점", "숲", "구릉", "초지" };
                Text(new Rect(point.x - 52, point.y - 18, 110, 20),
                    terrain[region.Terrain] + (region.Yield > 0 ? " · 생산 +" + region.Yield : ""), tinyStyle);
                int offset = 0;
                for (int person = 0; person < world.People.Length; person++)
                {
                    if (world.People[person].Region != i) continue;
                    if (Button(new Rect(point.x - 40, point.y + 16 + offset * 27, 80, 25),
                        world.People[person].Name, person == selected ? Color.white : tint))
                        selected = person;
                    offset++;
                }
            }
            GUI.EndGroup();
            Text(new Rect(305, 519, 680, 24), "고정된 연결망 · 시드 기반 지형 유형과 생산량 · 이동은 하루에 한 지역", tinyStyle);
        }

        private void Inspector()
        {
            Box(new Rect(1044, 96, 366, 756), panel);
            var person = world.People[selected];
            Text(new Rect(1065, 112, 325, 32), person.Name + "  /  " + world.Nations[person.Home].Name, headingStyle);
            Text(new Rect(1065, 153, 325, 40), person.Values, mutedStyle);
            for (int i = 0; i < world.People.Length; i++)
                if (Button(new Rect(1065 + i * 83, 198, 77, 32), world.People[i].Name, selected == i ? teal : line))
                    selected = i;
            Text(new Rect(1065, 247, 325, 25), "현재 위치 · " + world.Regions[person.Region].Name, bodyStyle);
            Text(new Rect(1065, 280, 325, 60), person.Activity, bodyStyle);
            Text(new Rect(1065, 346, 325, 25), "소지품 · 식량 " + person.Cargo + " / 동전 " + person.Coins, bodyStyle);
            Text(new Rect(1065, 385, 325, 25), "이 인물이 아는 정보", headingStyle);
            for (int i = 0; i < 2; i++)
                Text(new Rect(1065, 422 + i * 25, 325, 25),
                    world.Nations[i].Name + " · " + (person.SeenAt[i] < 0 ? "미확인" : "식량 " + person.KnownFood[i] + " (" + person.SeenAt[i] + "일 관찰)"), mutedStyle);
            if (Button(new Rect(1065, 488, 155, 34), "현지에서 교역")) Command(OrderType.Trade);
            if (Button(new Rect(1230, 488, 155, 34), "식량 전달")) Command(OrderType.Deliver);
            if (Button(new Rect(1065, 534, 320, 34), "현지 국가의 수출법 변경"))
                Command(OrderType.ExportLaw, world.Regions[person.Region].Nation);
            Text(new Rect(1065, 585, 325, 25), "룬 주문", headingStyle);
            spellText = GUI.TextField(new Rect(1065, 620, 320, 32), spellText, 100);
            Text(new Rect(1065, 660, 320, 40), "생장 ↔ 서리 / 증폭 ↔ 감쇠\n괄호로 중첩 · 원소 다음에 보조 룬", mutedStyle);
            var plan = SpellPlan.Parse(spellText);
            string cost = plan.Valid
                ? "마력 " + plan.Mana + " / 보유 " + person.Mana + "\n공물 " + plan.Offerings + " / 보유 " + person.Offerings
                : plan.Error;
            Text(new Rect(1065, 713, 320, 60), cost, bodyStyle);
            GUI.enabled = plan.Valid && plan.Mana <= person.Mana && plan.Offerings <= person.Offerings;
            if (Button(new Rect(1065, 790, 320, 38), "주문 시전 예약", teal)) Command(OrderType.Spell);
            GUI.enabled = true;
        }

        private void History()
        {
            Box(new Rect(282, 570, 744, 282), panel);
            Text(new Rect(303, 584, 340, 30), "세계의 기록", headingStyle);
            Text(new Rect(710, 588, 290, 25), "사건 번호 → 원인 사건 번호", mutedStyle);
            historyScroll = GUI.BeginScrollView(new Rect(300, 627, 710, 207), historyScroll,
                new Rect(0, 0, 680, Math.Max(207, Math.Min(100, world.Events.Count) * 55)));
            for (int row = 0; row < Math.Min(100, world.Events.Count); row++)
            {
                var entry = world.Events[world.Events.Count - row - 1];
                Text(new Rect(0, row * 55, 670, 18), entry.Tick + "일 · #" + entry.Id
                    + (entry.Cause > 0 ? " → #" + entry.Cause : ""), tinyStyle);
                Text(new Rect(0, row * 55 + 19, 670, 34), entry.Text, bodyStyle);
            }
            GUI.EndScrollView();
        }

        private void Command(OrderType type, int target = 0)
        {
            world.Queue(new Order { Actor = selected, Target = target, Type = type, Runes = spellText });
            feedback = world.People[selected].Name + " 명령 예약 · " + (world.Tick + 1) + "일에 검증·실행됩니다. 이후 자율 행동을 이어갑니다.";
        }

        private void ResetWorld()
        {
            if (!int.TryParse(seedText, out int seed)) { feedback = "시드는 정수로 입력하세요."; return; }
            world = new World(seed, initialWest, initialEast);
            startWest = initialWest;
            startEast = initialEast;
            running = false;
            accumulator = 0;
            feedback = "새 세계 생성 · 식량과 시드 설정이 적용되었습니다.";
        }

        private string SavePath => Path.Combine(Application.persistentDataPath, "tellus-prototype.json");

        private void Save()
        {
            try
            {
                var replay = new Replay { seed = world.Seed, westFood = startWest, eastFood = startEast,
                    tick = world.Tick, orders = world.Inputs.ToArray() };
                File.WriteAllText(SavePath, JsonUtility.ToJson(replay, true));
                feedback = "초기 세계와 개입 기록 저장 완료 · " + SavePath;
            }
            catch (Exception error) { feedback = "저장 실패 · " + error.Message; }
        }

        private int startWest = 16;
        private int startEast = 42;

        private void Load()
        {
            try
            {
                var replay = JsonUtility.FromJson<Replay>(File.ReadAllText(SavePath));
                if (replay == null || replay.tick < 0 || replay.tick > 100000 || replay.orders == null
                    || replay.orders.Length > 10000 || replay.westFood < 0 || replay.westFood > 10000
                    || replay.eastFood < 0 || replay.eastFood > 10000)
                    throw new InvalidDataException("저장 데이터 범위를 확인하세요.");
                var restored = new World(replay.seed, replay.westFood, replay.eastFood);
                int order = 0;
                for (int tick = 0; tick <= replay.tick; tick++)
                {
                    while (order < replay.orders.Length && replay.orders[order].Tick == tick + 1)
                        restored.Queue(replay.orders[order++]);
                    if (tick < replay.tick) restored.Step();
                }
                if (order != replay.orders.Length) throw new InvalidDataException("명령 기록의 순서가 올바르지 않습니다.");
                world = restored;
                initialWest = startWest = replay.westFood;
                initialEast = startEast = replay.eastFood;
                seedText = replay.seed.ToString();
                running = false;
                accumulator = 0;
                feedback = "기록 재생 완료 · " + world.Tick + "일의 세계를 복원했습니다.";
            }
            catch (Exception error) { feedback = "불러오기 실패 · " + error.Message; }
        }

        private void Box(Rect rect, Color color)
        {
            Color previous = GUI.color;
            GUI.color = color;
            GUI.DrawTexture(rect, white);
            GUI.color = previous;
        }

        private void Text(Rect rect, string text, GUIStyle style) => GUI.Label(rect, text, style);

        private bool Button(Rect rect, string text, Color? color = null)
        {
            Color previous = GUI.backgroundColor;
            GUI.backgroundColor = color ?? new Color(.29f, .37f, .39f);
            bool clicked = GUI.Button(rect, text, buttonStyle);
            GUI.backgroundColor = previous;
            return clicked;
        }

        private void DrawLine(Vector2 from, Vector2 to, float width, Color color)
        {
            int segments = Mathf.CeilToInt(Vector2.Distance(from, to) / width);
            for (int i = 0; i <= segments; i++)
            {
                Vector2 point = Vector2.Lerp(from, to, (float)i / segments);
                Box(new Rect(point.x, point.y, width, width), color);
            }
        }
    }
}
