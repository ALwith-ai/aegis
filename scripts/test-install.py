import hashlib,json,os,pathlib,shutil,subprocess,tempfile
root=pathlib.Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix='aegis-install-test-') as tmp:
    tmp=pathlib.Path(tmp); home=tmp/'home'; home.mkdir(); mock=tmp/'mock'; mock.mkdir(); fixture=tmp/'fixture'; fixture.mkdir()
    arch='arm64' if os.uname().machine=='arm64' else 'x64'; asset='aegis-darwin-'+arch
    shutil.copyfile(root/'dist'/asset,fixture/asset)
    (fixture/'VERSION').write_text('v'+json.loads((root/'package.json').read_text())['version'])
    (fixture/'SHA256SUMS').write_text(hashlib.sha256((fixture/asset).read_bytes()).hexdigest()+'  '+asset+'\n')
    runtime=home/'.aegis/dsh/0.2.1rc2';runtime.mkdir(parents=True);(runtime/'.complete').touch()
    curl=mock/'curl';curl.write_text('#!'+shutil.which('python3')+'\nimport os,sys,pathlib,shutil\na=sys.argv[1:];url=next(x for x in a if x.startswith("https:"));shutil.copyfile(pathlib.Path(os.environ["FIXTURE"])/url.split("/")[-1],a[a.index("-o")+1])\n');curl.chmod(0o755)
    token='fixture_personal_token_0123456789'
    env=dict(os.environ,HOME=str(home),PATH=f'{mock}:/usr/bin:/bin:/usr/sbin:/sbin',AEGIS_TOKEN=token,AEGIS_INSTALL_DIR=str(home/"test's bin"),FIXTURE=str(fixture),SHELL='/bin/zsh')
    for key in ['ZDOTDIR','AEGIS_CREDENTIALS']:env.pop(key,None)
    result=subprocess.run(['/bin/sh',str(root/'install.sh')],env=env,check=True,capture_output=True,text=True)
    assert token not in result.stdout+result.stderr
    creds=home/'.config/aegis/credentials.json';assert json.loads(creds.read_text())['token']==token;assert creds.stat().st_mode&0o777==0o600
    env.pop('AEGIS_TOKEN')
    check=subprocess.run(['/bin/zsh','-c','source "$HOME/.zshrc"; aegis --check-config'],env=env,check=True,capture_output=True,text=True)
    assert check.stdout.strip()=='Configured'
    subprocess.run(['/bin/sh',str(root/'install.sh')],env=env,check=True,stdout=subprocess.DEVNULL)
    assert (home/'.zshrc').read_text().count('# Aegis')==1
    assert not (root/'aegis-reports').exists(), 'Installer must not start an investigation'
    print('Install/configure, secret permissions, persisted credential, quoted path and idempotency passed.')
