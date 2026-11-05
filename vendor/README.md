# Microsoft Authentication Library

Microsoft公式の `@azure/msal-browser` **5.27.0** を同梱する。Microsoft Entraへの接続が設定されている場合だけ読み込む。実行時に外部CDNのスクリプトを取り込まない。ライセンスは `MSAL-LICENSE.txt`。

- 配布元: https://registry.npmjs.org/@azure/msal-browser/-/msal-browser-5.27.0.tgz
- npm tarball integrity: `sha512-i2CKKyuCuOZEBZJiAoFK/viYZAP6CRaqqlkeHl3ViteDHOUE/tkI/Slq1cdGnwhkIB+k1OE0g00QGl9O0gAFNQ==`
- `msal-browser-5.27.0.min.js` SHA-256: `f3f5f6f1476d2386ef3ac335a0b08a5dcd7713ff2276c4de5e635529c1a63fff`
- `msal-redirect-bridge-5.27.0.min.js` SHA-256: `510acbc788663c60c9eab42504bd945ae5005941f5570db8709465d58efb1008`

更新時は公式npm配布物のintegrityを検証し、ライブラリとredirect bridgeを同じバージョンから取得する。最小化済みファイルの内容は変更しない。Microsoft接続の開始・解除・再接続と、トークンの保存先を再検証する。
