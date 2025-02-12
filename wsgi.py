from app import app, fetch_ase_locations

# Fetch ASE locations once at the start
fetch_ase_locations()

if __name__ == "__main__":
    app.run()
