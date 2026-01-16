import os
import re
import json
from pathlib import Path
import time

SCRIPT_DIR = Path(__file__).parent.resolve()
OUTPUT_DIR = SCRIPT_DIR / 'dist'
LANG_CONFIG = {
    'zh': {
        'source': SCRIPT_DIR / 'tldr' / 'pages.zh',
        'names': {
            'common': '通用工具 (Common)',
            'linux': 'Linux 运维',
            'android': 'Android 开发',
            'windows': 'Windows',
            'osx': 'macOS',
            'sunos': 'SunOS'
        }
    },
    'en': {
        'source': SCRIPT_DIR / 'tldr' / 'pages',
        'names': {
            'common': 'Common Tools',
            'linux': 'Linux Ops',
            'android': 'Android Dev',
            'windows': 'Windows',
            'osx': 'macOS',
            'sunos': 'SunOS'
        }
    }
}

def parse_markdown(content, cmd_name, platform, lang, platform_display_name):
    """
    解析单个 Markdown 文件内容
    """
    prompts = []
    lines = content.splitlines()

    desc_lines = []
    for line in lines:
        line = line.strip()
        if line.startswith('>'):
            clean_line = line[1:].strip()
            clean_line = re.sub(r'<[^>]+>|\[([^\]]+)\]\([^\)]+\)', '', clean_line)
            if re.search(r'(?:More information|更多信息|See also|参见)\s*[:：]', clean_line, re.IGNORECASE):
                continue
            clean_line = clean_line.strip()

            if clean_line:
                desc_lines.append(clean_line)

    description = ' '.join(desc_lines) or f"{cmd_name} command"

    current_action = None
    index = 0

    for line in lines:
        line = line.strip()

        if line.startswith('- '):
            raw_action = line[2:]
            current_action = re.sub(r'[:：\.\s]+$', '', raw_action)

        elif line.startswith('`') and line.endswith('`') and current_action:
            code_content = line.strip('`')

            prompts.append({
                "id": f"tldr-{lang}-{platform}-{cmd_name}-{index}",
                "type": "command",
                "title": f"{cmd_name} - {current_action}",
                "content": code_content,
                "group": platform_display_name,
                "description": f"{cmd_name}: {description} ({current_action})",
                "tags": [platform, cmd_name, 'tldr', lang],
                "source": "official"
            })

            current_action = None
            index += 1
            
    return prompts

def main():
    print("开始构建 CtxRun 指令库...")
    print(f"脚本位置: {SCRIPT_DIR}")

    if not OUTPUT_DIR.exists():
        OUTPUT_DIR.mkdir(parents=True)

    manifest_packages = []

    for lang, config in LANG_CONFIG.items():
        source_dir = config['source']
        names_map = config['names']

        print(f"处理语言: [{lang}]")
        print(f"   源路径: {source_dir}")

        if not source_dir.exists():
            print(f"错误: 找不到源目录 {source_dir}，跳过此语言。")
            continue

        lang_pack_dir = OUTPUT_DIR / 'packs' / lang
        if not lang_pack_dir.exists():
            lang_pack_dir.mkdir(parents=True)

        platforms = [d.name for d in source_dir.iterdir() if d.is_dir()]

        for platform in platforms:
            platform_path = source_dir / platform
            display_name = names_map.get(platform, platform.title())

            print(f"   处理平台: {platform} ({display_name})...")

            all_platform_prompts = []
            md_files = list(platform_path.glob('*.md'))

            for file_path in md_files:
                try:
                    content = file_path.read_text(encoding='utf-8')
                    cmd_name = file_path.stem

                    prompts = parse_markdown(content, cmd_name, platform, lang, display_name)
                    all_platform_prompts.extend(prompts)
                except Exception as e:
                    print(f"      解析失败: {file_path.name} - {e}")

            if all_platform_prompts:
                output_filename = f"{platform}.json"
                output_path = lang_pack_dir / output_filename

                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(all_platform_prompts, f, ensure_ascii=False, indent=2)

                size_kb = round(output_path.stat().st_size / 1024)

                manifest_packages.append({
                    "id": f"{lang}-{platform}",
                    "language": lang,
                    "platform": platform,
                    "name": f"{display_name} ({lang.upper()})",
                    "description": f"Contains {len(all_platform_prompts)} {lang} commands for {platform}.",
                    "count": len(all_platform_prompts),
                    "size_kb": size_kb,
                    "url": f"packs/{lang}/{output_filename}",
                    "category": "command"
                })

    partial_manifest_path = OUTPUT_DIR / 'manifest_tldr_partial.json'

    with open(partial_manifest_path, 'w', encoding='utf-8') as f:
        json.dump(manifest_packages, f, ensure_ascii=False, indent=2)

    print(f"构建完成! 清单片段已生成: {partial_manifest_path}")
    print(f"产物目录: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()