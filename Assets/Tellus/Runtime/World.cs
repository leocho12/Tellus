using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace Tellus
{
    public enum OrderType { Travel, Deliver, Trade, ExportLaw, Spell }

    [Serializable]
    public sealed class Order
    {
        public int Tick;
        public int Actor;
        public int Target;
        public OrderType Type;
        public string Runes = "";
        public Order Copy() => (Order)MemberwiseClone();
    }

    public sealed class Nation
    {
        public string Name;
        public string Government;
        public int Food;
        public int Treasury = 30;
        public int Welfare = 70;
        public bool ExportBan;
        public int LawUntil;
        public int LastEvent;
    }

    public sealed class Region
    {
        public string Name;
        public int Nation;
        public int Yield;
        public int Terrain;
        public int[] Neighbours;
    }

    public sealed class Person
    {
        public string Name;
        public string Values;
        public int Home;
        public int Region;
        public int Target = -1;
        public int Cargo;
        public int Coins = 16;
        public int Mana = 24;
        public int Offerings = 3;
        public bool Generous;
        public string Activity = "주변 상황 관찰";
        public int LastEvent;
        public readonly int[] KnownFood = { -1, -1 };
        public readonly int[] SeenAt = { -1, -1 };
    }

    public sealed class Chronicle
    {
        public int Id;
        public int Tick;
        public int Cause;
        public string Text;
    }

    public sealed class SpellPlan
    {
        public bool Valid;
        public string Error;
        public int Mana;
        public int Offerings;
        public int Food;
        public bool Ice;

        public static SpellPlan Parse(string input)
        {
            var plan = new SpellPlan();
            var tokens = (input ?? "").Replace("(", " ( ").Replace(")", " ) ")
                .Split(new[] { ' ', '\t', '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries);
            if (tokens.Length == 0 || tokens.Length > 24)
                return Fail("룬 1~24개를 입력하세요.");
            var counts = new Stack<int>();
            counts.Push(0);
            var used = new HashSet<string>();
            bool element = false;
            int strength = 2;
            foreach (string token in tokens)
            {
                if (token == "(")
                {
                    if (counts.Count >= 4) return Fail("중첩은 3단계까지 가능합니다.");
                    counts.Push(0);
                    continue;
                }
                if (token == ")")
                {
                    if (counts.Count == 1 || counts.Pop() == 0) return Fail("괄호 또는 빈 중첩을 확인하세요.");
                    int parent = counts.Pop();
                    counts.Push(parent + 1);
                    continue;
                }
                if (token != "생장" && token != "서리" && token != "증폭" && token != "감쇠")
                    return Fail("알 수 없는 룬 · " + token);
                if ((token == "생장" && used.Contains("서리")) || (token == "서리" && used.Contains("생장"))
                    || (token == "증폭" && used.Contains("감쇠")) || (token == "감쇠" && used.Contains("증폭")))
                    return Fail("상충하는 룬은 중첩 위치와 관계없이 함께 사용할 수 없습니다.");
                if ((token == "증폭" || token == "감쇠") && !element)
                    return Fail("생장 또는 서리 뒤에 보조 룬을 배열하세요.");
                if (token == "생장" || token == "서리")
                {
                    if (element) return Fail("한 주문에는 원소 룬 하나를 사용하세요.");
                    element = true;
                    plan.Ice = token == "서리";
                }
                else strength = token == "증폭" ? strength + 2 * counts.Count : Math.Max(1, strength / 2);
                plan.Mana += (token == "생장" || token == "서리" ? 4 : 2) * counts.Count;
                if (token == "증폭") plan.Offerings++;
                used.Add(token);
                int count = counts.Pop();
                counts.Push(count + 1);
            }
            if (counts.Count != 1 || !element) return Fail("원소 룬과 닫는 괄호를 확인하세요.");
            plan.Valid = true;
            plan.Food = strength;
            return plan;
        }

        private static SpellPlan Fail(string error) => new SpellPlan { Error = error };
    }

    // The simulation uses integer state and explicit commands, independent of Unity's frame rate.
    public sealed class World
    {
        public int Seed { get; }
        public int Tick { get; private set; }
        public int Relations { get; private set; } = 0;
        public int TradeCount { get; private set; }
        public Nation[] Nations { get; }
        public Region[] Regions { get; }
        public Person[] People { get; }
        public List<Chronicle> Events { get; } = new List<Chronicle>();
        public List<Order> Inputs { get; } = new List<Order>();
        private readonly List<Order> pending = new List<Order>();

        public World(int seed, int westFood = 16, int eastFood = 42)
        {
            Seed = seed;
            Nations = new[] {
                new Nation { Name = "아르덴 왕국", Government = "왕실 칙령 · 질서와 생존", Food = Math.Max(0, westFood) },
                new Nation { Name = "세라 상인 연합", Government = "상인회의 · 교역과 번영", Food = Math.Max(0, eastFood) }
            };
            var random = new Random(seed);
            string[] names = { "아르덴", "서쪽 들판", "돌고개", "나루터", "황금 평야", "세라" };
            Regions = new Region[6];
            for (int i = 0; i < 6; i++)
            {
                var neighbours = new List<int>();
                if (i > 0) neighbours.Add(i - 1);
                if (i < 5) neighbours.Add(i + 1);
                Regions[i] = new Region {
                    Name = names[i], Nation = i < 3 ? 0 : 1,
                    Yield = i == 1 ? 1 : i == 4 ? 4 + random.Next(2) : 0,
                    Terrain = i == 0 || i == 5 ? 0 : random.Next(1, 4),
                    Neighbours = neighbours.ToArray()
                };
            }
            People = new[] {
                new Person { Name = "리아", Values = "백성의 생존 · 구호 우선", Home = 0, Region = 0, Generous = true },
                new Person { Name = "카일", Values = "자국의 안정 · 재산 보전", Home = 0, Region = 1 },
                new Person { Name = "에밀", Values = "호혜와 평화 · 구호 우선", Home = 1, Region = 5, Generous = true },
                new Person { Name = "로웬", Values = "부와 교역 · 수익 우선", Home = 1, Region = 4 }
            };
            Add("세계 생성 · 아르덴의 생산량은 소비량보다 낮습니다. 교역과 개입의 결과를 관찰하세요.");
            Observe();
        }

        public void Queue(Order order)
        {
            var copy = order.Copy();
            copy.Tick = Tick + 1;
            pending.Add(copy);
            Inputs.Add(copy.Copy());
        }

        public void Step()
        {
            Tick++;
            var controlled = new HashSet<int>();
            foreach (var command in pending.ToArray())
            {
                Apply(command);
                if (command.Actor >= 0 && command.Actor < People.Length) controlled.Add(command.Actor);
            }
            pending.Clear();
            for (int i = 0; i < Nations.Length; i++)
            {
                var nation = Nations[i];
                nation.Food += Regions.Where(r => r.Nation == i).Sum(r => r.Yield);
                int consumed = Math.Min(3, nation.Food);
                nation.Food -= consumed;
                nation.Welfare = Math.Max(0, Math.Min(100, nation.Welfare + (consumed < 3 ? -4 : 1)));
                if (consumed < 3 && Tick % 3 == 0)
                    nation.LastEvent = Add(nation.Name + " 식량 부족 · 생활 안정도 하락", nation.LastEvent);
                if (Tick > nation.LawUntil && Tick % 8 == 0)
                {
                    bool ban = nation.Food < (i == 0 ? 10 : 5);
                    SetLaw(i, ban, false);
                }
            }
            Observe();
            for (int i = 0; i < People.Length; i++)
            {
                if (!controlled.Contains(i)) Decide(i);
                if (Tick % 5 == 0) People[i].Mana = Math.Min(24, People[i].Mana + 1);
            }
            Observe();
        }

        private void Observe()
        {
            foreach (var person in People)
            {
                int nation = Regions[person.Region].Nation;
                person.KnownFood[nation] = Nations[nation].Food;
                person.SeenAt[nation] = Tick;
            }
        }

        private void Decide(int index)
        {
            var person = People[index];
            if (person.Target >= 0 && person.Target != person.Region)
            {
                Move(person);
                return;
            }
            person.Target = -1;
            bool home = Regions[person.Region].Nation == person.Home;
            if (!home)
            {
                Trade(person);
                person.Target = person.Home == 0 ? 0 : 5;
                return;
            }
            if (person.Cargo > 0)
            {
                Deliver(person);
                return;
            }
            var nation = Nations[person.Home];
            int reserve = person.Generous ? 18 : 12;
            if (nation.Food > reserve + 5 && !nation.ExportBan)
            {
                person.Cargo = 5;
                nation.Food -= 5;
                person.Activity = "여유 식량 5 운송 · " + (person.Generous ? "이웃을 돕기 위해" : "교역 수익을 위해");
                person.LastEvent = Add(person.Name + " · " + person.Activity, nation.LastEvent);
            }
            else person.Activity = "식량을 구하러 출발 · 자국의 재고 " + nation.Food;
            person.Target = person.Home == 0 ? 5 : 0;
            Move(person);
        }

        private void Move(Person person)
        {
            int next = person.Region + Math.Sign(person.Target - person.Region);
            if (!Regions[person.Region].Neighbours.Contains(next)) return;
            person.Region = next;
            person.LastEvent = Add(person.Name + " → " + Regions[next].Name + " · " + person.Activity, person.LastEvent);
        }

        private void Deliver(Person person)
        {
            int local = Regions[person.Region].Nation;
            if (person.Cargo <= 0) { person.Activity = "전달할 식량 없음"; return; }
            Nations[local].Food += person.Cargo;
            person.LastEvent = Add(person.Name + " 식량 " + person.Cargo + " 전달 → " + Nations[local].Name, person.LastEvent);
            Nations[local].LastEvent = person.LastEvent;
            if (local != person.Home) Relations = Math.Min(100, Relations + 2);
            person.Cargo = 0;
            person.Activity = "식량 전달 완료";
        }

        private void Trade(Person person)
        {
            int local = Regions[person.Region].Nation;
            var nation = Nations[local];
            if (person.Cargo > 0)
            {
                if (person.Generous && nation.Food < 12)
                {
                    Deliver(person);
                    return;
                }
                int amount = Math.Min(person.Cargo, nation.Treasury);
                if (amount == 0) { person.Activity = "거절 · 상대 국고 부족"; return; }
                nation.Food += amount;
                nation.Treasury -= amount;
                person.Coins += amount;
                person.Cargo -= amount;
                TradeCount++;
                person.LastEvent = Add(person.Name + " 식량 " + amount + " 판매 · 동전 +" + amount, person.LastEvent);
                person.Activity = "판매 완료";
            }
            else
            {
                if (nation.ExportBan && local != person.Home)
                {
                    person.Activity = "구매 거절 · 현지 수출 금지법";
                    person.LastEvent = Add(person.Name + " · " + person.Activity, nation.LastEvent);
                    return;
                }
                int amount = Math.Min(5, Math.Min(person.Coins, Math.Max(0, nation.Food - 8)));
                if (amount == 0) { person.Activity = "구매 불가 · 식량 여유 또는 동전 부족"; return; }
                person.Cargo += amount;
                person.Coins -= amount;
                nation.Food -= amount;
                nation.Treasury += amount;
                TradeCount++;
                person.LastEvent = Add(person.Name + " 식량 " + amount + " 구매 · 동전 -" + amount, nation.LastEvent);
                person.Activity = "구매 완료 · 자국으로 운송";
            }
            if (local != person.Home) Relations = Math.Min(100, Relations + 1);
            nation.LastEvent = person.LastEvent;
        }

        private void Apply(Order command)
        {
            int cause = Add("플레이어 개입 · " + command.Type);
            if (command.Type == OrderType.ExportLaw)
            {
                if (command.Target < 0 || command.Target >= Nations.Length) { Add("명령 거절 · 국가 없음", cause); return; }
                SetLaw(command.Target, !Nations[command.Target].ExportBan, true);
                return;
            }
            if (command.Actor < 0 || command.Actor >= People.Length) { Add("명령 거절 · 인물 없음", cause); return; }
            var person = People[command.Actor];
            person.LastEvent = cause;
            switch (command.Type)
            {
                case OrderType.Travel:
                    if (command.Target < 0 || command.Target >= Regions.Length) { Add("명령 거절 · 목적지 없음", cause); return; }
                    person.Target = command.Target;
                    person.Activity = "플레이어 지정 목적지로 이동";
                    if (person.Region != person.Target) Move(person);
                    break;
                case OrderType.Deliver: Deliver(person); break;
                case OrderType.Trade: Trade(person); break;
                case OrderType.Spell:
                    var spell = SpellPlan.Parse(command.Runes);
                    if (!spell.Valid || person.Mana < spell.Mana || person.Offerings < spell.Offerings)
                    {
                        Add("시전 거절 · " + (spell.Error ?? "마력 또는 공물 부족"), cause);
                        return;
                    }
                    var nation = Nations[Regions[person.Region].Nation];
                    person.Mana -= spell.Mana;
                    person.Offerings -= spell.Offerings;
                    int delta = spell.Ice ? -Math.Min(nation.Food, spell.Food) : spell.Food;
                    nation.Food += delta;
                    nation.LastEvent = Add(person.Name + " [" + command.Runes + "] · 현지 식량 " + (delta >= 0 ? "+" : "") + delta
                        + " / 마력 -" + spell.Mana + " / 공물 -" + spell.Offerings, cause);
                    person.Activity = "시전 완료";
                    break;
            }
        }

        private void SetLaw(int index, bool ban, bool player)
        {
            var nation = Nations[index];
            if (player) nation.LawUntil = Tick + 20;
            if (nation.ExportBan == ban && !player) return;
            nation.ExportBan = ban;
            nation.LastEvent = Add(nation.Name + " · " + (index == 0 ? "왕실 칙령" : "상인회의 의결")
                + " · " + (ban ? "식량 수출 금지" : "식량 교역 허용")
                + (player ? " (플레이어 제정 · 20일간 유지)" : " (자국 식량 " + nation.Food + "에 따른 판단)"), nation.LastEvent);
        }

        private int Add(string text, int cause = 0)
        {
            int id = Events.Count + 1;
            Events.Add(new Chronicle { Id = id, Tick = Tick, Cause = cause, Text = text });
            return id;
        }

        public string Fingerprint()
        {
            var text = new StringBuilder().Append(Seed).Append('|').Append(Tick).Append('|').Append(Relations);
            foreach (var n in Nations) text.Append('|').Append(n.Food).Append(',').Append(n.Treasury).Append(',').Append(n.Welfare).Append(',').Append(n.ExportBan);
            foreach (var p in People) text.Append('|').Append(p.Region).Append(',').Append(p.Target).Append(',').Append(p.Cargo).Append(',').Append(p.Coins).Append(',').Append(p.Mana).Append(',').Append(p.Offerings);
            foreach (var e in Events) text.Append('|').Append(e.Id).Append(',').Append(e.Cause).Append(',').Append(e.Text);
            return text.ToString();
        }
    }
}
