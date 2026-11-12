using System;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace Tellus.Editor
{
    public static class PrototypeTools
    {
        private const string ScenePath = "Assets/Scenes/TellusPrototype.unity";

        [MenuItem("Tellus/Open Prototype")]
        public static void Open()
        {
            if (EditorApplication.isPlaying) return;
            if (!EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) return;
            if (File.Exists(ScenePath)) EditorSceneManager.OpenScene(ScenePath);
            else
            {
                var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
                var camera = new GameObject("Overview Camera").AddComponent<Camera>();
                camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = new Color(.045f, .065f, .075f);
                camera.orthographic = true;
                camera.transform.position = new Vector3(0, 0, -10);
                EditorSceneManager.SaveScene(scene, ScenePath);
            }
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
            Debug.Log("TELLUS_READY " + ScenePath);
        }

        [MenuItem("Tellus/Verify Simulation")]
        public static void Verify()
        {
            try
            {
                var first = new World(1206);
                var second = new World(1206);
                for (int i = 0; i < 200; i++) first.Step();
                for (int batch = 0; batch < 10; batch++)
                    for (int step = 0; step < 20; step++) second.Step();
                Check(first.Fingerprint() == second.Fingerprint(), "Tick batching changes state");
                Check(first.TradeCount > 0, "Autonomous trade never happened");
                Check(first.Events.Any(e => e.Text.Contains("식량 부족")), "Scarcity was not simulated");
                Check(first.Events.Any(e => e.Text.Contains("→")), "Autonomous movement missing");
                Check(first.Nations.All(n => n.Food >= 0 && n.Treasury >= 0), "Negative national resources");
                Check(first.People.All(p => p.Cargo >= 0 && p.Coins >= 0), "Negative inventory");

                var replay = new World(19, 23, 50);
                var source = new World(19, 23, 50);
                for (int day = 0; day < 30; day++)
                {
                    if (day == 2 || day == 10)
                        source.Queue(new Order { Actor = 0, Type = OrderType.Spell, Runes = "생장 (증폭)" });
                    if (day == 6) source.Queue(new Order { Actor = 2, Type = OrderType.ExportLaw, Target = 1 });
                    source.Step();
                }
                for (int day = 0; day < 30; day++)
                {
                    foreach (var order in source.Inputs.Where(o => o.Tick == day + 1)) replay.Queue(order);
                    replay.Step();
                }
                Check(source.Fingerprint() == replay.Fingerprint(), "Input replay mismatch");

                var invalid = new World(1206);
                int mana = invalid.People[0].Mana;
                int offerings = invalid.People[0].Offerings;
                invalid.Queue(new Order { Actor = 0, Type = OrderType.Spell, Runes = "생장 (서리)" });
                invalid.Step();
                Check(invalid.People[0].Mana == mana && invalid.People[0].Offerings == offerings, "Invalid spell spent resources");
                Check(!SpellPlan.Parse("생장 (서리)").Valid, "Nested conflict accepted");
                Check(!SpellPlan.Parse("생장 (증폭 감쇠)").Valid, "Modifier conflict accepted");
                Check(!SpellPlan.Parse("생장 ()").Valid, "Empty scope accepted");
                Check(!SpellPlan.Parse("생장 (증폭").Valid, "Unclosed scope accepted");
                Check(!SpellPlan.Parse("증폭 생장").Valid, "Invalid order accepted");
                var spell = SpellPlan.Parse("생장 (증폭)");
                Check(spell.Valid && spell.Mana == 8 && spell.Offerings == 1 && spell.Food == 6, "Nested cost incorrect");
                var valid = new World(1206);
                var baseline = new World(1206);
                baseline.Queue(new Order { Actor = 0, Type = OrderType.Spell, Runes = "unknown" });
                valid.Queue(new Order { Actor = 0, Type = OrderType.Spell, Runes = "생장 (증폭)" });
                valid.Step();
                baseline.Step();
                Check(valid.People[0].Mana == 16 && valid.People[0].Offerings == 2, "Valid spell cost mismatch");
                int totalFood = valid.Nations.Sum(n => n.Food) + valid.People.Sum(p => p.Cargo);
                int baselineFood = baseline.Nations.Sum(n => n.Food) + baseline.People.Sum(p => p.Cargo);
                Check(totalFood == baselineFood + 6, "Spell did not add the expected food to the world");

                var blind = new World(1206);
                Check(blind.People[0].KnownFood[1] == -1, "Private foreign stock leaked");
                blind.Queue(new Order { Actor = 0, Type = OrderType.Travel, Target = 5 });
                Check(blind.Tick == 0 && blind.People[0].Region == 0, "Paused queue executed immediately");
                blind.Step();
                Check(blind.People[0].Region == 1, "Travel did not advance one region");
                blind.Step();
                Check(blind.People[0].Region == 2, "Travel route did not continue");
                blind.Step();
                Check(blind.People[0].KnownFood[1] >= 0, "Local information not observed");
                Check(blind.Events.All(e => e.Cause == 0 || e.Cause < e.Id), "Invalid causal reference");
                File.WriteAllText("Library/TellusVerification.txt", "PASS · determinism, replay, autonomous trade, movement, resource bounds, observation, queued commands, rune syntax/conflicts/costs/effects");
                Debug.Log("TELLUS_TESTS_PASS");
            }
            catch (Exception error)
            {
                File.WriteAllText("Library/TellusVerification.txt", "FAIL " + error);
                Debug.LogException(error);
            }
        }

        [MenuItem("Tellus/Build Windows Prototype")]
        public static void Build()
        {
            PlayerSettings.productName = "Tellus Prototype";
            PlayerSettings.defaultScreenWidth = 1440;
            PlayerSettings.defaultScreenHeight = 900;
            PlayerSettings.fullScreenMode = FullScreenMode.Windowed;
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
                scenes = new[] { ScenePath }, locationPathName = "Builds/Tellus/Tellus.exe",
                target = BuildTarget.StandaloneWindows64, options = BuildOptions.None
            });
            File.WriteAllText("Library/TellusBuild.txt", report.summary.result + " / " + report.summary.totalErrors + " errors");
            if (report.summary.result != BuildResult.Succeeded) Debug.LogError("Tellus build failed");
            else Debug.Log("TELLUS_BUILD_PASS Builds/Tellus/Tellus.exe");
        }

        private static void Check(bool condition, string message)
        {
            if (!condition) throw new InvalidOperationException(message);
        }
    }
}
