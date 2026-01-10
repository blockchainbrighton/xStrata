export async function processRecursiveAudio(clipBuffers) {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const decodedBuffers = await Promise.all(
    clipBuffers.map(async (buf) => {
      const tempBuf = buf.slice(0); 
      return await audioCtx.decodeAudioData(tempBuf);
    })
  );
  const totalLength = decodedBuffers.reduce((acc, b) => acc + b.length, 0);
  const outputBuffer = audioCtx.createBuffer(
    decodedBuffers[0].numberOfChannels,
    totalLength,
    decodedBuffers[0].sampleRate
  );
  let offset = 0;
  for (const buf of decodedBuffers) {
    for (const channel of [0, 1]) {
      if (channel < buf.numberOfChannels) {
        outputBuffer.getChannelData(channel).set(buf.getChannelData(channel), offset);
      }
    }
    offset += buf.length;
  }
  return { audioCtx, outputBuffer };
}
