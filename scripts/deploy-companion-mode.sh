#!/usr/bin/env bash
# scripts/deploy-companion-mode.sh
#
# Run ON THE SPARK (bash ~/git/immersivePortfolio/scripts/deploy-companion-mode.sh).
# Deploys the avatar-chat WebXR companion mode per docs/NEXT_STEPS.md:
#   1. merge origin/claude/webxr-companion-prompt into master
#   2. sync the companion prompt's teleport scene list to the live
#      5-scene roster (the branch predates the manifest restructure and
#      still lists the old 9 scenes — wrong sceneIds would break
#      window.teleportTo in the frontend)
#   3. insert the new WEBXR COMPANION MODE section into the live,
#      gitignored system_prompt.txt (backed up first; DYNAMICALLY ADDED
#      KNOWLEDGE entries untouched)
#   4. restart jeff-avatar.service
#
# Safe to re-run: every step is idempotent or skips itself.

set -euo pipefail
cd "$HOME/git/avatar-chat"

echo "== 1/4 merge companion branch =="
git fetch origin --quiet
if git merge-base --is-ancestor origin/claude/webxr-companion-prompt HEAD; then
  echo "already merged, skipping"
else
  git merge --no-edit origin/claude/webxr-companion-prompt
fi

echo "== 2/4 sync teleport scene list to the 5-scene roster =="
python3 - <<'EOF'
p = "system_prompt.template.txt"
s = open(p, encoding="utf-8").read()
if "scene-01-hangar-polder" in s:
    print("scene list already synced, skipping")
else:
    start = s.index("- scene-01-holographic-studio")
    end = s.index("\n\n", s.index("- scene-03-northeastern"))
    new = """- scene-01-hangar-polder — Roots: Royal Netherlands Air Force hangar opening onto a Dutch polder (F-16, Chinook, windmill) — where Jeff's engineering story begins
- scene-02-perception-lab — Roots: research lab spanning Jeff's Master's (rubber hand illusion, TU Eindhoven) and PhD (eye-tracker + data-glove rig, Northeastern)
- scene-01-holo-stage — Career: AfterNow Prez holographic presentation theater (podium HoloLens, hologram exhibits, headset gear wall)
- scene-02-second-studio-construct — Career: Second Studio collaborative VR — mountaintop platform with a human-scale skyscraper sculpture (entered by putting on the Vive)
- scene-03-lightworks — Career: datacenter cathedral — server-repair training bay, four-projector optical-computing gallery, Even Realities smart-glasses desk"""
    open(p, "w", encoding="utf-8").write(s[:start] + new + s[end:])
    print("scene list rewritten (9 -> 5)")
EOF
if ! git diff --quiet system_prompt.template.txt; then
  git add system_prompt.template.txt
  git commit -m "Sync companion-mode teleport list to the 5-scene roster"
fi

echo "== 3/4 patch live system_prompt.txt =="
cp system_prompt.txt "system_prompt.txt.bak-$(date +%Y%m%d-%H%M%S)"
python3 - <<'EOF'
tpl = open("system_prompt.template.txt", encoding="utf-8").read()
live = open("system_prompt.txt", encoding="utf-8").read()
if "WEBXR COMPANION MODE" in live:
    print("live prompt already has companion mode, skipping")
else:
    start = tpl.index("\n---\n\n## WEBXR COMPANION MODE")
    end = tpl.index("\n---\n\n## DYNAMICALLY ADDED KNOWLEDGE", start)
    section = tpl[start:end]
    anchor = live.index("\n---\n\n## DYNAMICALLY ADDED KNOWLEDGE")
    open("system_prompt.txt", "w", encoding="utf-8").write(live[:anchor] + section + live[anchor:])
    print("companion-mode section inserted before DYNAMICALLY ADDED KNOWLEDGE")
EOF

echo "== 4/4 restart jeff-avatar.service =="
systemctl --user restart jeff-avatar.service 2>/dev/null || sudo systemctl restart jeff-avatar.service
sleep 3
(systemctl --user status jeff-avatar.service 2>/dev/null || systemctl status jeff-avatar.service) --no-pager | head -3

echo "Done. Backup of the previous live prompt is alongside system_prompt.txt."
