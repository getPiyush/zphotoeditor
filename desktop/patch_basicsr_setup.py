#!/usr/bin/env python3
"""Patch basicsr's setup.py to read its version without exec()+locals().

basicsr==1.4.2 (unmaintained) computes its package version like this:

    def get_version():
        with open(version_file, 'r') as f:
            exec(compile(f.read(), version_file, 'exec'))
        return locals()['__version__']

Python 3.13 changed locals() semantics for function scopes (PEP 667): each
call now returns an independent snapshot, so the name exec() adds is no
longer visible to the following locals() call. That turns this function into
a guaranteed "KeyError: '__version__'" on 3.13, which aborts the pip build
before it even gets to resolving basicsr's dependencies. Replace it with a
regex read of the same generated file, which is Python-version-agnostic.
"""
import re
import sys

BUGGY = """def get_version():
    with open(version_file, 'r') as f:
        exec(compile(f.read(), version_file, 'exec'))
    return locals()['__version__']"""

FIXED = """def get_version():
    with open(version_file, 'r') as f:
        content = f.read()
    return re.search(r"__version__\\s*=\\s*'([^']+)'", content).group(1)"""


def main() -> int:
    setup_py_path = sys.argv[1]
    with open(setup_py_path) as f:
        src = f.read()

    if BUGGY not in src:
        print(
            f"error: {setup_py_path} does not contain the expected buggy "
            "get_version() body. basicsr's setup.py may have changed "
            "upstream - update patch_basicsr_setup.py's BUGGY/FIXED strings "
            "to match, or drop this patch if it's no longer needed.",
            file=sys.stderr,
        )
        return 1

    src = src.replace(BUGGY, FIXED, 1)
    src = src.replace("import subprocess\n", "import re\nimport subprocess\n", 1)

    with open(setup_py_path, "w") as f:
        f.write(src)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
