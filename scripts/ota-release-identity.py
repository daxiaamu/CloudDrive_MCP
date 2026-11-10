import json, os, sys, zipfile
release=json.load(open(sys.argv[1],encoding='utf-8'))
version=release['tag_name'].removeprefix('v')
archive=os.path.join(sys.argv[2],f'CloudDriveMCP-{version}-Windows-x64-Portable.zip')
prefix=f'CloudDriveMCP-{version}-Windows-x64/'
with zipfile.ZipFile(archive) as z:
    entries={}
    for name in z.namelist():
        normalized=name.replace('\\','/')
        if normalized in entries: raise ValueError('duplicate normalized archive path')
        entries[normalized]=name
    package=json.loads(z.read(entries[prefix+'resources/app/package.json']))
    bundle=json.loads(z.read(entries[prefix+'bundle.json']))
    if package.get('name')!='cloud-drive-mcp' or package.get('version')!=version or bundle.get('version')!=version:
        raise ValueError('release tag and package identity do not match')
