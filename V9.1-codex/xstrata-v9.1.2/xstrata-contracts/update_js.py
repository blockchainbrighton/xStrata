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
# We look for CONTRACT_SOURCE_BATCHXR_V6=`
# Then capture everything until the next backtick.
# Note: The JS file seems to have `CONTRACT_SOURCE_BATCHXR_V6=` followed immediately by the backtick.
pattern = r'(CONTRACT_SOURCE_BATCHXR_V6=`)[​‌‍‎‏⁠-⁯﻿
	\]*?(`)'

# Replacement: group 1 + newline + new_contract + group 2 (the closing backtick)
# We use a lambda or function to handle the replacement string to avoid escaping issues
def replacer(match):
    # match.group(1) is "CONTRACT_SOURCE_BATCHXR_V6=`"
    # match.group(2) is "`" (the closing backtick)
    # We strip the first line of new_contract if it's just a comment to avoid double comments if desired,
    # but the regex replaces everything inside, so we just dump the whole file.
    return match.group(1) + "\n" + new_contract + match.group(2)

new_js_content, count = re.subn(pattern, replacer, js_content, count=1)

if count == 0:
    print('Error: Could not find contract source string to replace.')
    exit(1)

# Write back
with open(js_path, 'w') as f:
    f.write(new_js_content)

print(f'Successfully updated JS bundle. replaced {count} occurrence.')
