import re
import os

# Read new contract code
with open('contracts/u64bxr-v6-1.clar', 'r') as f:
    new_contract = f.read()

# Read JS bundle
js_path = 'assets/index-06f51251-2.js'
with open(js_path, 'r') as f:
    js_content = f.read()

# Regex to find the variable assignment and the backtick-enclosed string
pattern = r"(CONTRACT_SOURCE_BATCHXR_V6=`)([\s\S]*?)(`)"

def replacer(match):
    return match.group(1) + "\n" + new_contract + match.group(3)

new_js_content, count = re.subn(pattern, replacer, js_content, count=1)

if count == 0:
    print('Error: Could not find contract source string to replace.')
    exit(1)

# Write back
with open(js_path, 'w') as f:
    f.write(new_js_content)

print(f'Successfully updated JS bundle. replaced {count} occurrence.')
