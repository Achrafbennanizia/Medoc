use std::io::{self, Write};

use tracing_subscriber::fmt::MakeWriter;

use super::sanitizer::sanitize;

pub struct SanitizingWriter<W: Write> {
    pub inner: W,
}

impl<W: Write> Write for SanitizingWriter<W> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        let n = buf.len();
        let s = String::from_utf8_lossy(buf);
        let redacted = sanitize(&s);
        self.inner.write_all(redacted.as_bytes())?;
        Ok(n)
    }

    fn flush(&mut self) -> io::Result<()> {
        self.inner.flush()
    }
}

pub struct SanitizingMakeWriter<W>(pub W);

impl<'a, W> MakeWriter<'a> for SanitizingMakeWriter<W>
where
    W: MakeWriter<'a>,
{
    type Writer = SanitizingWriter<W::Writer>;

    fn make_writer(&'a self) -> Self::Writer {
        SanitizingWriter {
            inner: self.0.make_writer(),
        }
    }
}
