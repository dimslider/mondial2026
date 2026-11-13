import { registerRoot, staticFile } from 'remotion';
import { loadFont } from '@remotion/fonts';
import { Root } from './Root';

for (const weight of ['500', '600', '700', '800']) {
  loadFont({ family: 'Poppins', url: staticFile(`fonts/poppins-latin-${weight}-normal.woff2`), weight });
}

registerRoot(Root);
