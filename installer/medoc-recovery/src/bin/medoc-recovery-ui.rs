//! Native GUI for Safe Bridge recovery (eframe/egui, same stack as USB Setup).

fn main() {
    if let Err(e) = medoc_recovery::ui_entry() {
        eprintln!("error: {e}");
        std::process::exit(1);
    }
}
